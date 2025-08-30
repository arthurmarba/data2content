// src/app/components/auth/TermsAcceptanceStep.tsx
// v1.0.2 - Link para Termos e Condições atualizado.
// - Link da Política de Privacidade mantido.

import React, { useState } from 'react';
import Image from 'next/image';

interface TermsAcceptanceStepProps {
  userName?: string | null; 
  onAcceptAndContinue: () => void; 
}

const TermsAcceptanceStep: React.FC<TermsAcceptanceStepProps> = ({
  userName,
  onAcceptAndContinue,
}) => {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showError, setShowError] = useState(false);

  const handleSubmit = () => {
    if (!termsAccepted) {
      setShowError(true);
      return;
    }
    setShowError(false);
    onAcceptAndContinue(); 
  };

  // URLs para seus documentos legais
  const termsAndConditionsUrl = "https://data2content.ai/termos-e-condicoes";
  const privacyPolicyUrl = "https://data2content.ai/politica-de-privacidade"; 

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg transform transition-all">
        <div className="text-center mb-8">
          <span className="inline-flex items-center justify-center gap-2">
            <span className="relative inline-block h-8 w-8 overflow-hidden align-middle">
              <Image
                src="/images/Colorido-Simbolo.png"
                alt="Data2Content"
                fill
                className="object-contain object-center scale-[2.4]"
                priority
              />
            </span>
            <span className="text-2xl font-extrabold tracking-tight text-brand-dark">data2content</span>
          </span>
          {userName && (
            <h1 className="text-2xl font-semibold text-gray-800 mt-4">
              Olá, {userName}! Bem-vindo(a) à Data2Content!
            </h1>
          )}
          <p className="text-gray-600 mt-2">
            {userName 
              ? "Para finalizar seu cadastro e começar a usar a plataforma," 
              : "Para criar sua conta na Data2Content,"}
            <br />
            por favor, revise e aceite nossos termos.
          </p>
        </div>

        <div className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
          <p>
            Ao {userName ? "continuar" : "criar sua conta na Data2Content"}, você concorda com nossos{' '}
            <a 
              href={termsAndConditionsUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="font-medium text-brand-pink hover:underline"
            >
              Termos e Condições
            </a>{' '}
            e nossa{' '}
            <a 
              href={privacyPolicyUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="font-medium text-brand-pink hover:underline"
            >
              Política de Privacidade
            </a>
            .
          </p>
          <p className="mt-2">
            Estes documentos são importantes e explicam como seus dados são utilizados, 
            incluindo sua participação na <strong className="font-semibold">Comunidade de Inspiração</strong> – uma funcionalidade 
            essencial da nossa plataforma que permite o compartilhamento de exemplos de 
            conteúdo (seus posts públicos do Instagram, sempre com link para o original, 
            e insights de desempenho de forma agregada e anônima para indicar relevância) 
            para inspirar outros criadores como você.
          </p>
        </div>

        <div className="mb-6">
          <label htmlFor="termsAccepted" className="flex items-center cursor-pointer">
            <input
              id="termsAccepted"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => {
                setTermsAccepted(e.target.checked);
                if (e.target.checked) {
                  setShowError(false);
                }
              }}
              className="h-5 w-5 text-brand-pink border-gray-300 rounded focus:ring-brand-pink focus:ring-offset-0"
            />
            <span className="ml-3 text-sm text-gray-700">
              Li e concordo com os Termos e Condições e a Política de Privacidade da Data2Content.
            </span>
          </label>
          {showError && !termsAccepted && (
            <p className="text-red-500 text-xs mt-2 ml-8">
              Você precisa aceitar os termos para continuar.
            </p>
          )}
        </div>

        <button
          onClick={handleSubmit}
          className={`w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white 
                      ${termsAccepted ? 'bg-brand-pink hover:bg-pink-700 focus:ring-pink-500' : 'bg-gray-300 cursor-not-allowed'} 
                      focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150`}
        >
          {userName ? "Aceitar e Entrar na Data2Content" : "Criar Minha Conta"}
        </button>
      </div>

      <footer className="text-center mt-8 py-4 text-xs text-gray-500">
        &copy; {new Date().getFullYear()} Data2Content. Todos os direitos reservados.
      </footer>
    </div>
  );
};

export default TermsAcceptanceStep;
