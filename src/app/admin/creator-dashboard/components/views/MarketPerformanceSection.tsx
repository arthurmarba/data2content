"use client";

import React from "react";
import GlobalPeriodIndicator from "../GlobalPeriodIndicator";
import MarketPerformanceChart from "../MarketPerformanceChart";

interface Props {
  formatOptions: string[];
  proposalOptions: string[];
  marketFormat: string;
  marketProposal: string;
  setMarketFormat: (v: string) => void;
  setMarketProposal: (v: string) => void;
}

const MarketPerformanceSection: React.FC<Props> = ({
  formatOptions,
  proposalOptions,
  marketFormat,
  marketProposal,
  setMarketFormat,
  setMarketProposal,
}) => (
  <section id="market-performance" className="mb-10">
    <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6 pb-2 border-b border-gray-300">
      Desempenho do Mercado <GlobalPeriodIndicator />
    </h2>
    <div className="flex flex-col md:flex-row gap-4 mb-4">
      <div>
        <label
          htmlFor="mp-format"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Formato
        </label>
        <select
          id="mp-format"
          value={marketFormat}
          onChange={(e) => setMarketFormat(e.target.value)}
          className="p-2 border border-gray-300 rounded-md text-sm"
        >
          {formatOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="mp-proposal"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Proposta
        </label>
        <select
          id="mp-proposal"
          value={marketProposal}
          onChange={(e) => setMarketProposal(e.target.value)}
          className="p-2 border border-gray-300 rounded-md text-sm"
        >
          {proposalOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    </div>
    <MarketPerformanceChart format={marketFormat} proposal={marketProposal} />
  </section>
);

export default MarketPerformanceSection;
