/**
 * KB-First v3.0 - GNN Engine Template
 * 
 * Graph Neural Network for modeling decision webs and relationship propagation.
 * Use this for applications where changing one thing affects many others.
 */

import { Pool } from 'pg';

// =============================================================================
// TYPES
// =============================================================================

export interface GraphNode {
  id: string;
  type: 'decision' | 'outcome' | 'constraint' | 'entity';
  label: string;
  currentValue?: any;
  possibleValues?: any[];
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  relationship: 'affects' | 'requires' | 'conflicts' | 'enables' | 'depends_on';
  weight: number;  // 0-1, strength of influence
  direction: 'unidirectional' | 'bidirectional';
  transform?: string;  // Name of transform function
  metadata?: Record<string, any>;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata?: Record<string, any>;
}

export interface PropagationResult {
  changedNode: string;
  originalValue: any;
  newValue: any;
  depth: number;
  path: string[];
  confidence: number;
}

export interface SimulationResult {
  initialChange: { node: string; from: any; to: any };
  directEffects: PropagationResult[];
  cascadingEffects: PropagationResult[];
  equilibrium: Record<string, any>;
  confidence: number;
}

export interface GNNConfig {
  hiddenDim: number;
  numLayers: number;
  aggregation: 'sum' | 'mean' | 'max' | 'attention';
  dropout?: number;
  learningRate?: number;
}

// =============================================================================
// GNN ENGINE
// =============================================================================

export class GNNEngine {
  private pool: Pool;
  private config: GNNConfig;
  private transforms: Map<string, (value: any, weight: number) => any>;

  constructor(config: GNNConfig, databaseUrl?: string) {
    this.config = {
      hiddenDim: config.hiddenDim || 128,
      numLayers: config.numLayers || 3,
      aggregation: config.aggregation || 'attention',
      dropout: config.dropout || 0.1,
      learningRate: config.learningRate || 0.001
    };

    if (databaseUrl) {
      this.pool = new Pool({ connectionString: databaseUrl });
    }

    this.transforms = new Map();
    this.registerDefaultTransforms();
  }

  // ---------------------------------------------------------------------------
  // GRAPH MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Build a graph from node and edge definitions
   */
  buildGraph(nodes: GraphNode[], edges: GraphEdge[]): Graph {
    // Validate edges reference existing nodes
    const nodeIds = new Set(nodes.map(n => n.id));
    for (const edge of edges) {
      if (!nodeIds.has(edge.from)) {
        throw new Error(`Edge references unknown node: ${edge.from}`);
      }
      if (!nodeIds.has(edge.to)) {
        throw new Error(`Edge references unknown node: ${edge.to}`);
      }
    }

    return { nodes, edges };
  }

  /**
   * Load graph from database
   */
  async loadGraph(namespace: string): Promise<Graph> {
    const client = await this.pool.connect();
    try {
      const nodesResult = await client.query(`
        SELECT id, type, label, current_value, possible_values, embedding, metadata
        FROM gnn_nodes WHERE namespace = $1
      `, [namespace]);

      const edgesResult = await client.query(`
        SELECT id, from_node, to_node, relationship, weight, direction, transform, metadata
        FROM gnn_edges WHERE namespace = $1
      `, [namespace]);

      return {
        nodes: nodesResult.rows.map(r => ({
          id: r.id,
          type: r.type,
          label: r.label,
          currentValue: r.current_value,
          possibleValues: r.possible_values,
          embedding: r.embedding,
          metadata: r.metadata
        })),
        edges: edgesResult.rows.map(r => ({
          id: r.id,
          from: r.from_node,
          to: r.to_node,
          relationship: r.relationship,
          weight: r.weight,
          direction: r.direction,
          transform: r.transform,
          metadata: r.metadata
        }))
      };
    } finally {
      client.release();
    }
  }

  /**
   * Save graph to database
   */
  async saveGraph(graph: Graph, namespace: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Clear existing
      await client.query('DELETE FROM gnn_edges WHERE namespace = $1', [namespace]);
      await client.query('DELETE FROM gnn_nodes WHERE namespace = $1', [namespace]);

      // Insert nodes
      for (const node of graph.nodes) {
        await client.query(`
          INSERT INTO gnn_nodes (id, namespace, type, label, current_value, possible_values, embedding, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [node.id, namespace, node.type, node.label, node.currentValue, 
            node.possibleValues, node.embedding, node.metadata || {}]);
      }

      // Insert edges
      for (const edge of graph.edges) {
        await client.query(`
          INSERT INTO gnn_edges (id, namespace, from_node, to_node, relationship, weight, direction, transform, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [edge.id, namespace, edge.from, edge.to, edge.relationship,
            edge.weight, edge.direction, edge.transform, edge.metadata || {}]);
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // ---------------------------------------------------------------------------
  // PROPAGATION SIMULATION
  // ---------------------------------------------------------------------------

  /**
   * Simulate what happens when a node value changes
   */
  async simulate(
    graph: Graph,
    change: { node: string; newValue: any },
    options: { maxDepth?: number; minWeight?: number } = {}
  ): Promise<SimulationResult> {
    const { maxDepth = 4, minWeight = 0.1 } = options;

    const node = graph.nodes.find(n => n.id === change.node);
    if (!node) throw new Error(`Node not found: ${change.node}`);

    const originalValue = node.currentValue;
    const directEffects: PropagationResult[] = [];
    const cascadingEffects: PropagationResult[] = [];
    const visited = new Set<string>();
    const newValues: Record<string, any> = { [change.node]: change.newValue };

    // BFS propagation
    const queue: { nodeId: string; depth: number; path: string[]; confidence: number }[] = [];

    // Find direct edges from changed node
    const directEdges = graph.edges.filter(e => e.from === change.node);
    for (const edge of directEdges) {
      if (edge.weight >= minWeight) {
        queue.push({
          nodeId: edge.to,
          depth: 1,
          path: [change.node, edge.to],
          confidence: edge.weight
        });
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (visited.has(current.nodeId) || current.depth > maxDepth) {
        continue;
      }
      visited.add(current.nodeId);

      const targetNode = graph.nodes.find(n => n.id === current.nodeId);
      if (!targetNode) continue;

      // Calculate new value based on incoming edges
      const incomingEdges = graph.edges.filter(e => e.to === current.nodeId);
      let newValue = targetNode.currentValue;
      
      for (const edge of incomingEdges) {
        if (newValues[edge.from] !== undefined) {
          const transform = this.transforms.get(edge.transform || 'linear');
          if (transform) {
            newValue = transform(newValues[edge.from], edge.weight);
          }
        }
      }

      newValues[current.nodeId] = newValue;

      const effect: PropagationResult = {
        changedNode: current.nodeId,
        originalValue: targetNode.currentValue,
        newValue: newValue,
        depth: current.depth,
        path: current.path,
        confidence: current.confidence
      };

      if (current.depth === 1) {
        directEffects.push(effect);
      } else {
        cascadingEffects.push(effect);
      }

      // Queue downstream nodes
      const outgoingEdges = graph.edges.filter(e => e.from === current.nodeId);
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.to) && edge.weight >= minWeight) {
          queue.push({
            nodeId: edge.to,
            depth: current.depth + 1,
            path: [...current.path, edge.to],
            confidence: current.confidence * edge.weight
          });
        }
      }
    }

    return {
      initialChange: { node: change.node, from: originalValue, to: change.newValue },
      directEffects,
      cascadingEffects,
      equilibrium: newValues,
      confidence: this.calculateOverallConfidence(directEffects, cascadingEffects)
    };
  }

  /**
   * Compare two scenarios
   */
  async compareScenarios(
    graph: Graph,
    scenarioA: { node: string; newValue: any },
    scenarioB: { node: string; newValue: any }
  ): Promise<{
    scenarioA: SimulationResult;
    scenarioB: SimulationResult;
    differences: { node: string; valueA: any; valueB: any; impact: number }[];
    recommendation: 'A' | 'B' | 'equivalent';
  }> {
    const resultA = await this.simulate(graph, scenarioA);
    const resultB = await this.simulate(graph, scenarioB);

    const allNodes = new Set([
      ...Object.keys(resultA.equilibrium),
      ...Object.keys(resultB.equilibrium)
    ]);

    const differences: { node: string; valueA: any; valueB: any; impact: number }[] = [];
    
    for (const nodeId of allNodes) {
      const valueA = resultA.equilibrium[nodeId];
      const valueB = resultB.equilibrium[nodeId];
      
      if (valueA !== valueB) {
        differences.push({
          node: nodeId,
          valueA,
          valueB,
          impact: Math.abs(this.numericValue(valueA) - this.numericValue(valueB))
        });
      }
    }

    differences.sort((a, b) => b.impact - a.impact);

    return {
      scenarioA: resultA,
      scenarioB: resultB,
      differences,
      recommendation: resultA.confidence > resultB.confidence ? 'A' : 
                      resultB.confidence > resultA.confidence ? 'B' : 'equivalent'
    };
  }

  // ---------------------------------------------------------------------------
  // GNN LAYER OPERATIONS (SQL)
  // ---------------------------------------------------------------------------

  /**
   * Apply GCN layer via SQL
   */
  async applyGCNLayer(
    nodeFeatures: number[][],
    adjacencyMatrix: number[][],
    weights: number[][]
  ): Promise<number[][]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT ruvector_gnn_gcn_layer($1, $2, $3) as features
      `, [nodeFeatures, adjacencyMatrix, weights]);
      return result.rows[0].features;
    } finally {
      client.release();
    }
  }

  /**
   * Apply Graph Attention layer via SQL
   */
  async applyGATLayer(
    nodeFeatures: number[][],
    adjacencyMatrix: number[][],
    attentionWeights: number[][],
    numHeads: number
  ): Promise<number[][]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT ruvector_gnn_gat_layer($1, $2, $3, $4) as features
      `, [nodeFeatures, adjacencyMatrix, attentionWeights, numHeads]);
      return result.rows[0].features;
    } finally {
      client.release();
    }
  }

  /**
   * Message passing via SQL
   */
  async messagePassing(
    nodeFeatures: number[][],
    edgeIndex: number[][],
    edgeFeatures: number[][],
    aggregation: 'sum' | 'mean' | 'max'
  ): Promise<number[][]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT ruvector_gnn_message_pass($1, $2, $3, $4) as features
      `, [nodeFeatures, edgeIndex, edgeFeatures, aggregation]);
      return result.rows[0].features;
    } finally {
      client.release();
    }
  }

  // ---------------------------------------------------------------------------
  // TRANSFORMS
  // ---------------------------------------------------------------------------

  registerTransform(name: string, fn: (value: any, weight: number) => any): void {
    this.transforms.set(name, fn);
  }

  private registerDefaultTransforms(): void {
    // Linear: New value scales proportionally
    this.transforms.set('linear', (value, weight) => {
      if (typeof value === 'number') return value * weight;
      return value;
    });

    // Inverse: Opposite relationship
    this.transforms.set('inverse', (value, weight) => {
      if (typeof value === 'number') return value * (1 - weight);
      return value;
    });

    // Threshold: Binary effect above threshold
    this.transforms.set('threshold', (value, weight) => {
      if (typeof value === 'number') return value > 0.5 ? weight : 0;
      return value;
    });

    // Delay: Effect with delay factor
    this.transforms.set('delay', (value, weight) => {
      if (typeof value === 'number') return value * weight * 0.8;
      return value;
    });
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private calculateOverallConfidence(
    direct: PropagationResult[],
    cascading: PropagationResult[]
  ): number {
    const allEffects = [...direct, ...cascading];
    if (allEffects.length === 0) return 1.0;
    
    const avgConfidence = allEffects.reduce((sum, e) => sum + e.confidence, 0) / allEffects.length;
    return avgConfidence;
  }

  private numericValue(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    return 0;
  }
}

// =============================================================================
// SCHEMA FOR GNN TABLES
// =============================================================================

export const GNN_SCHEMA = `
-- GNN Nodes
CREATE TABLE IF NOT EXISTS gnn_nodes (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('decision', 'outcome', 'constraint', 'entity')),
  label TEXT NOT NULL,
  current_value JSONB,
  possible_values JSONB,
  embedding vector(384),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GNN Edges
CREATE TABLE IF NOT EXISTS gnn_edges (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  from_node TEXT NOT NULL REFERENCES gnn_nodes(id),
  to_node TEXT NOT NULL REFERENCES gnn_nodes(id),
  relationship TEXT NOT NULL CHECK (relationship IN ('affects', 'requires', 'conflicts', 'enables', 'depends_on')),
  weight REAL NOT NULL CHECK (weight >= 0 AND weight <= 1),
  direction TEXT DEFAULT 'unidirectional' CHECK (direction IN ('unidirectional', 'bidirectional')),
  transform TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS gnn_nodes_namespace_idx ON gnn_nodes(namespace);
CREATE INDEX IF NOT EXISTS gnn_edges_namespace_idx ON gnn_edges(namespace);
CREATE INDEX IF NOT EXISTS gnn_edges_from_idx ON gnn_edges(from_node);
CREATE INDEX IF NOT EXISTS gnn_edges_to_idx ON gnn_edges(to_node);
`;

export default GNNEngine;
