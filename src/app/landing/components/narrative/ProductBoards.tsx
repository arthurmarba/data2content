import { Check, Play, Sparkles, X } from "lucide-react";

import { MAP_GROUPS } from "@/app/landing/narrativeData";

export function MapBoard({ compact = false, animate = false }: { compact?: boolean; animate?: boolean }) {
  return (
    <div className={`d2c-map-board ${compact ? "d2c-map-board--compact" : ""}`}>
      <div className="d2c-map-board__topline">
        <div className="d2c-map-board__identity">
          <span className="d2c-map-board__spark"><Sparkles size={15} aria-hidden="true" /></span>
          <span><b>Seu Mapa</b><small>vivo e editável</small></span>
        </div>
        <span className="d2c-map-board__action">Aprimorar</span>
      </div>
      <p className="d2c-map-board__statement">um creator que defende a autonomia criativa como negócio</p>
      <div className="d2c-map-board__groups">
        {MAP_GROUPS.map((group, groupIndex) => (
          <div className="d2c-map-group" key={group.label}>
            <span className="d2c-map-group__label">{group.label}</span>
            <div className="d2c-map-group__chips">
              {group.items.map((item, itemIndex) => (
                <span
                  className={`d2c-map-chip d2c-map-chip--${group.tone} ${animate ? "d2c-map-chip--animated" : ""}`}
                  key={item}
                  style={animate ? { animationDelay: `${groupIndex * 140 + itemIndex * 65}ms` } : undefined}
                >
                  {item}<i aria-hidden="true">×</i>
                </span>
              ))}
              {!compact && <span className="d2c-map-chip d2c-map-chip--add">+ adicionar</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="d2c-map-board__footer"><span>2 análises</span><span>atualizado há 3 dias</span></div>
    </div>
  );
}

export function IdeaBoard() {
  return (
    <div className="d2c-idea-board">
      <div className="d2c-idea-board__meta"><span>Autonomia criativa</span><small>Reels</small></div>
      <h3>Como comecei a defender a liberdade de criar com a minha cara</h3>
      <div className="d2c-idea-board__opening">
        <small>Abre com</small>
        <p>“Por muito tempo, achei que precisava me adaptar ao que dava certo...”</p>
      </div>
      <div className="d2c-idea-board__choices" aria-label="Exemplo de escolha de pauta">
        <span><i><X size={16} aria-hidden="true" /></i>não é pra mim</span>
        <span className="is-yes"><i><Check size={17} aria-hidden="true" /></i>quero gravar</span>
      </div>
    </div>
  );
}

export function AnalysisBoard() {
  return (
    <div className="d2c-analysis-board">
      <span className="d2c-analysis-board__status">Análise concluída</span>
      <div className="d2c-analysis-board__video"><Play size={22} fill="currentColor" aria-hidden="true" /></div>
      <div className="d2c-analysis-board__verdict">
        <small>Leitura da sua narrativa</small>
        <h3>Este vídeo fortalece um território que já é reconhecível em você.</h3>
        <p>Ele conecta autonomia criativa, bastidores e uma situação real da sua trajetória.</p>
      </div>
      <div className="d2c-analysis-board__meter"><i /><span>fortalece sua narrativa</span></div>
    </div>
  );
}
