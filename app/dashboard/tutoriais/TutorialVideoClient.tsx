"use client";

import { useState } from "react";
import { Video, Plus, Trash2, Play, ShieldCheck, ExternalLink, X } from "lucide-react";

interface VideoItem {
  id: string;
  title: string;
  description?: string | null;
  youtubeUrl: string;
  embedId: string;
  category: string;
  createdAt: string | Date;
}

export function TutorialVideoClient({
  initialVideos,
  isManager,
}: {
  initialVideos: VideoItem[];
  isManager: boolean;
}) {
  const [videos, setVideos] = useState<VideoItem[]>(initialVideos);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [category, setCategory] = useState("Instalação e Configuração");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !youtubeUrl) {
      setError("Título e Link do YouTube são obrigatórios.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/tutoriais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, youtubeUrl, category, description }),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || "Erro ao adicionar vídeo");
      }

      setVideos((prev) => [data.video, ...prev]);
      setTitle("");
      setYoutubeUrl("");
      setDescription("");
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVideo = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este vídeo tutorial?")) return;

    try {
      const res = await fetch(`/api/tutoriais?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setVideos((prev) => prev.filter((v) => v.id !== id));
      }
    } catch (err: any) {
      alert("Erro ao excluir vídeo.");
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Video className="h-5 w-5 text-blue-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Central de Tutoriais</h1>
          </div>
          <p className="text-xs text-zinc-400">
            Aprenda a instalar, configurar e operar seus robôs no MetaTrader 5 com passo a passo em vídeo.
          </p>
        </div>

        {isManager && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-blue-500 transition-all border border-blue-400/30"
          >
            <Plus className="h-4 w-4" />
            Cadastrar Novo Vídeo (Gestor)
          </button>
        )}
      </div>

      {/* Grid de Vídeos */}
      {videos.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <div
              key={v.id}
              className="group relative flex flex-col rounded-2xl bg-[#0D0D0D] border border-white/10 overflow-hidden shadow-xl hover:border-blue-500/30 transition-all duration-300"
            >
              {/* Thumbnail / Embed Player */}
              <div className="relative aspect-video bg-black overflow-hidden group">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${v.embedId}`}
                  title={v.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              </div>

              {/* Conteúdo */}
              <div className="p-4 flex flex-col gap-2 flex-1 justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400 border border-blue-500/20">
                      {v.category}
                    </span>
                    
                    {isManager && (
                      <button
                        onClick={() => handleDeleteVideo(v.id)}
                        className="text-zinc-500 hover:text-rose-400 transition p-1"
                        title="Excluir vídeo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-white line-clamp-2 leading-snug">{v.title}</h3>
                  {v.description && (
                    <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                      {v.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State com Cards de Construção / Em Breve */
        <div className="space-y-6">
          <div className="rounded-2xl border border-blue-500/20 bg-blue-950/10 p-6 text-center">
            <ShieldCheck className="h-8 w-8 text-blue-400 mx-auto mb-2" />
            <h3 className="text-base font-bold text-white">Vídeos em Produção pelo Gestor</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
              Os tutoriais em vídeo passo a passo (instalação no MT5, gerenciamento de risco e operação) estão sendo gravados pelo Gestor e ficarão disponíveis aqui em breve.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 opacity-60">
            <PlaceholderCard
              title="1. Como Instalar o Robô no MetaTrader 5"
              category="Instalação"
              desc="Aprenda a copiar o arquivo .ex5 para a pasta MQL5/Experts e colocar no gráfico correto."
            />
            <PlaceholderCard
              title="2. Gerenciamento de Risco e Tamanho de Lote"
              category="Gestão de Banca"
              desc="Entenda qual lote usar para o seu capital mínimo recomendado de forma conservadora."
            />
            <PlaceholderCard
              title="3. Acompanhamento pelo Zaion Monitor"
              category="Monitoramento"
              desc="Veja como conectar sua conta MT5 e acompanhar métricas em tempo real no painel."
            />
          </div>
        </div>
      )}

      {/* Modal para Adicionar Vídeo (Gestor) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#121212] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Cadastrar Novo Vídeo (Gestor)</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleAddVideo} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Título do Vídeo *</label>
                <input
                  type="text"
                  placeholder="Ex: Como Instalar o Robô no MT5 Passo a Passo"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#0A0A0A] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Link do Vídeo no YouTube (não-listado/público) *</label>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#0A0A0A] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#0A0A0A] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="Instalação e Configuração">Instalação e Configuração</option>
                  <option value="Gestão de Risco">Gestão de Risco</option>
                  <option value="Zaion Monitor">Zaion Monitor</option>
                  <option value="Dicas Operacionais">Dicas Operacionais</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Descrição Breve</label>
                <textarea
                  rows={3}
                  placeholder="Explicação do conteúdo abordado neste tutorial..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#0A0A0A] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-500 transition shadow-md disabled:opacity-50"
                >
                  {loading ? "Cadastrando..." : "Salvar Vídeo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PlaceholderCard({ title, category, desc }: { title: string; category: string; desc: string }) {
  return (
    <div className="rounded-2xl bg-[#0D0D0D] border border-white/10 p-4 space-y-3">
      <div className="aspect-video rounded-xl bg-black/60 border border-white/5 flex flex-col items-center justify-center text-center p-4">
        <Play className="h-8 w-8 text-zinc-600 mb-1" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Em Breve (Gravação)</span>
      </div>
      <div>
        <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400 border border-blue-500/20">
          {category}
        </span>
        <h4 className="text-xs font-bold text-white mt-1.5">{title}</h4>
        <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
