import { useEffect, useState, useRef } from 'react';
import { useApiClient } from '@/lib/api';
import type { DocumentListItem, KnowledgeStatusResult, MCPTool, SemanticPhraseResponse } from '@/features/knowledge/types';
import type { LiveRoutingSettings } from '@/features/logs/types';
import { getKnowledgeNumber } from '../components/helpers';

interface UnmatchedCount { count: number; }
interface EmbeddingHealth { ok?: boolean; status?: string; }
interface RagStatus {
  routingEnabled: boolean;
  dialect: string;
  embeddingModel?: string;
  embeddingDimensions?: number;
  registeredToolCount: number;
  indexedToolCount: number;
  semanticPhraseCount: number;
  indexingRunning: boolean;
}

const CACHE_KEY = 'najm-rag-studio:dashboard-cache';
const CACHE_TTL_MS = 30_000;

interface CachedData {
  timestamp: number;
  status: RagStatus;
  tools: MCPTool[];
  semantics: SemanticPhraseResponse[];
  knowledge: KnowledgeStatusResult;
  documents: DocumentListItem[];
  settings: LiveRoutingSettings;
  embeddingHealth: EmbeddingHealth;
  unmatched: UnmatchedCount;
}

function loadCache(): CachedData | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedData;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS * 10) return null;
    return parsed;
  } catch { return null; }
}

function saveCache(data: Omit<CachedData, 'timestamp'>) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, timestamp: Date.now() }));
  } catch { /* ignore quota errors */ }
}

export function useDashboardData() {
  const api = useApiClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<RagStatus | null>(null);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [semantics, setSemantics] = useState<SemanticPhraseResponse[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeStatusResult | null>(null);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [settings, setSettings] = useState<LiveRoutingSettings | null>(null);
  const [embeddingHealth, setEmbeddingHealth] = useState<EmbeddingHealth | null>(null);
  const [unmatched, setUnmatched] = useState<UnmatchedCount>({ count: 0 });
  const lastFetchRef = useRef(0);

  const applyData = (data: Omit<CachedData, 'timestamp'>) => {
    setStatus(data.status);
    setTools(data.tools);
    setSemantics(data.semantics);
    setKnowledge(data.knowledge);
    setDocuments(data.documents);
    setSettings(data.settings);
    setEmbeddingHealth(data.embeddingHealth);
    setUnmatched(data.unmatched);
  };

  const load = async () => {
    const now = Date.now();
    const isStale = now - lastFetchRef.current > CACHE_TTL_MS;

    if (!isStale && lastFetchRef.current > 0) return;

    setLoading(true);
    setError(null);
    try {
      const [
        nextStatus, nextTools, nextSemantics, nextKnowledge,
        nextDocuments, nextSettings, nextEmbeddingHealth, nextUnmatched,
      ] = await Promise.all([
        api.get<RagStatus>('/status'),
        api.get<MCPTool[]>('/tools/list'),
        api.get<SemanticPhraseResponse[]>('/semantics'),
        api.get<KnowledgeStatusResult>('/knowledge/status'),
        api.get<DocumentListItem[]>('/documents'),
        api.get<LiveRoutingSettings>('/settings'),
        api.get<EmbeddingHealth>('/health/embedding'),
        api.get<UnmatchedCount>('/unmatched/count'),
      ]);
      const data = {
        status: nextStatus,
        tools: nextTools,
        semantics: nextSemantics,
        knowledge: nextKnowledge,
        documents: nextDocuments,
        settings: nextSettings,
        embeddingHealth: nextEmbeddingHealth,
        unmatched: nextUnmatched,
      };
      applyData(data);
      saveCache(data);
      lastFetchRef.current = Date.now();
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError('Failed to load dashboard data. Click Refresh to retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = loadCache();
    if (cached) {
      applyData(cached);
      setLoading(false);
      lastFetchRef.current = cached.timestamp;
    }
    load().catch(() => {});
  }, []);

  const totalDeps = tools.reduce((sum, tool) => sum + (tool.dependencies?.length ?? 0), 0);
  const activePhrases = semantics.filter((phrase) => phrase.hasEmbedding).length;
  const pendingPhrases = semantics.length - activePhrases;
  const phraseCoverage = semantics.length > 0 ? Math.round((activePhrases / semantics.length) * 100) : 0;
  const documentCount = getKnowledgeNumber(knowledge, 'documents', 'documentCount') || documents.length;
  const chunkCount = getKnowledgeNumber(knowledge, 'chunks', 'chunkCount');
  const embeddingCount = getKnowledgeNumber(knowledge, 'embeddings', 'embeddingCount');
  const indexedDocs = documents.filter((doc) => doc.status === 'ready').length;
  const pendingDocs = documents.filter((doc) => doc.status === 'pending' || doc.status === 'extracting').length;
  const errorDocs = documents.filter((doc) => doc.status === 'failed').length;
  const routerOnline = status?.routingEnabled === true;
  const embeddingOnline = embeddingHealth?.ok === true || embeddingHealth?.status === 'ok';
  const knowledgeEnabled = settings?.enableKnowledge !== false;

  return {
    loading,
    error,
    status,
    tools,
    semantics,
    knowledge,
    documents,
    settings,
    embeddingHealth,
    unmatched,
    load,
    totalDeps,
    activePhrases,
    pendingPhrases,
    phraseCoverage,
    documentCount,
    chunkCount,
    embeddingCount,
    indexedDocs,
    pendingDocs,
    errorDocs,
    routerOnline,
    embeddingOnline,
    knowledgeEnabled,
  };
}
