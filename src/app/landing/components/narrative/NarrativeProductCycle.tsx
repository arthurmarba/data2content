"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { KeyboardEvent } from "react";
import { useRef, useState } from "react";

import { PRODUCT_MOMENTS, type ProductMoment } from "@/app/landing/narrativeData";

import { AnalysisBoard, IdeaBoard, MapBoard } from "./ProductBoards";

const MOMENT_KEYS = Object.keys(PRODUCT_MOMENTS) as ProductMoment[];

function ProductStage({ moment }: { moment: ProductMoment }) {
  return (
    <div className="d2c-product-window">
      <div className="d2c-product-window__bar"><i /><i /><i /><span>data2content / seu espaço</span></div>
      <AnimatePresence mode="wait">
        <motion.div
          key={moment}
          initial={{ opacity: 0, y: 15, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -10, filter: "blur(3px)" }}
          transition={{ duration: 0.32 }}
        >
          {moment === "mapa" && <MapBoard compact />}
          {moment === "pautas" && <IdeaBoard />}
          {moment === "analise" && <AnalysisBoard />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function NarrativeProductCycle() {
  const [moment, setMoment] = useState<ProductMoment>("mapa");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activateTab = (index: number) => {
    const normalizedIndex = (index + MOMENT_KEYS.length) % MOMENT_KEYS.length;
    const next = MOMENT_KEYS[normalizedIndex] ?? "mapa";
    setMoment(next);
    tabRefs.current[normalizedIndex]?.focus();
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      activateTab(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      activateTab(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      activateTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      activateTab(MOMENT_KEYS.length - 1);
    }
  };

  return (
    <div className="d2c-cycle__layout">
      <div className="d2c-cycle__steps" role="tablist" aria-label="Como a D2C funciona">
        {MOMENT_KEYS.map((key, index) => {
          const item = PRODUCT_MOMENTS[key];
          const selected = moment === key;
          return (
            <button
              key={key}
              ref={(node) => { tabRefs.current[index] = node; }}
              id={`d2c-product-tab-${key}`}
              aria-controls={`d2c-product-panel-${key}`}
              aria-selected={selected}
              className={selected ? "is-active" : ""}
              onClick={() => setMoment(key)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              role="tab"
              tabIndex={selected ? 0 : -1}
            >
              <span>{item.index}</span><div><small>{item.label}</small><b>{item.title}</b></div>
            </button>
          );
        })}
      </div>
      <div
        className="d2c-cycle__stage"
        id={`d2c-product-panel-${moment}`}
        role="tabpanel"
        aria-labelledby={`d2c-product-tab-${moment}`}
        tabIndex={0}
      >
        <ProductStage moment={moment} />
        <AnimatePresence mode="wait">
          <motion.p key={moment} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {PRODUCT_MOMENTS[moment].body}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
