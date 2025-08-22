"use client";

import React, { useState, useEffect } from "react";

const CookieConsent: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem("cookie_consent", "granted");
    (window as any).gtag?.("consent", "update", {
      ad_storage: "granted",
      analytics_storage: "granted",
    });
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-brand-dark text-brand-light p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <span>
        Utilizamos cookies para melhorar sua experiência. Aceita o uso de cookies?
      </span>
      <button
        onClick={acceptCookies}
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
      >
        Aceitar
      </button>
    </div>
  );
};

export default CookieConsent;

