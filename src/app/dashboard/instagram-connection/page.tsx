"use client";

import React, { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { FaInstagram, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import useInstagramStatus from "@/app/hooks/useInstagramStatus";
import { useToast } from "@/app/components/ui/ToastA11yProvider";
import { useRouter } from "next/navigation";

export default function InstagramConnectionPage() {
    const { status, isLoading, error, refetch } = useInstagramStatus(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [connectError, setConnectError] = useState<string | null>(null);
    const { toast } = useToast();
    const router = useRouter();

    const handleReconnect = async () => {
        setIsConnecting(true);
        setConnectError(null);
        try {
            const res = await fetch("/api/auth/iniciar-vinculacao-fb", { method: "POST" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.message || "Falha ao preparar a vinculação.");
            }
            const flowIdParam = typeof data?.flowId === "string" ? `&flowId=${encodeURIComponent(data.flowId)}` : "";
            await signIn("facebook", {
                callbackUrl: `/dashboard/instagram/connecting?instagramLinked=true&next=instagram-connection${flowIdParam}`,
            });
        } catch (e: any) {
            console.error("Falha ao iniciar fluxo Facebook/Instagram:", e);
            setConnectError(e?.message || "Erro inesperado. Tente novamente.");
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        if (!window.confirm("Tem certeza que deseja desconectar sua conta do Instagram?")) {
            return;
        }
        setIsDisconnecting(true);
        try {
            const res = await fetch("/api/instagram/disconnect", { method: "POST" });
            if (!res.ok) {
                throw new Error("Falha ao desconectar.");
            }
            toast({ variant: "success", title: "Conta desconectada com sucesso." });
            await refetch();
        } catch (e: any) {
            toast({ variant: "error", title: "Erro ao desconectar conta." });
        } finally {
            setIsDisconnecting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="w-full min-h-screen bg-[#FAFAFB]">
                <div className="dashboard-page-shell pt-header pb-safe">
                    <div className="max-w-[800px]">
                        <div className="animate-pulse space-y-4">
                            <div className="h-8 w-1/3 bg-gray-200 rounded"></div>
                            <div className="h-32 w-full bg-gray-200 rounded"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const isConnected = status?.isConnected;
    const hasProfile = !!status?.username;
    const profilePicture = status?.profilePictureUrl;

    return (
        <div className="min-h-screen w-full bg-[#FAFAFB]">
            <div className="dashboard-page-shell flex min-h-screen items-center justify-center py-6">
                <div className="w-full max-w-md space-y-6">

                {/* Header Minimalista */}
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900">Conexão Instagram</h1>
                    <p className="mt-2 text-sm text-gray-500">
                        Gerencie a integração com sua conta profissional.
                    </p>
                </div>

                {/* Card Principal */}
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">

                    {/* Estado: Com Perfil (Conectado ou Expirado) */}
                    {hasProfile ? (
                        <div className="flex flex-col items-center p-8 text-center">
                            <div className="relative mb-4">
                                <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-white shadow-md ring-1 ring-gray-100">
                                    {profilePicture ? (
                                        <Image
                                            src={profilePicture}
                                            alt={status.username ? `Foto de ${status.username}` : "Foto de perfil do Instagram"}
                                            width={96}
                                            height={96}
                                            className="h-full w-full object-cover"
                                            sizes="96px"
                                            priority
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-gray-50 text-[#D62E5E]">
                                            <FaInstagram className="h-8 w-8" />
                                        </div>
                                    )}
                                </div>
                                <div className={`absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white ${isConnected ? "bg-emerald-500" : "bg-amber-500"}`}>
                                    {isConnected ? (
                                        <FaCheckCircle className="h-4 w-4 text-white" />
                                    ) : (
                                        <FaExclamationTriangle className="h-4 w-4 text-white" />
                                    )}
                                </div>
                            </div>

                            <h2 className="text-lg font-semibold text-gray-900">
                                {status.pageName || status.username}
                            </h2>
                            <p className="text-sm text-gray-500">@{status.username}</p>

                            <div className={`mt-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${isConnected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                {isConnected ? "Sincronização Ativa" : "Reconexão Necessária"}
                            </div>

                            {!isConnected && (
                                <p className="mt-4 text-sm text-gray-600">
                                    O acesso à sua conta expirou. Reconecte para continuar sincronizando.
                                </p>
                            )}

                            <div className="mt-8 flex w-full flex-col gap-3">
                                <button
                                    onClick={handleReconnect}
                                    disabled={isConnecting || isDisconnecting}
                                    className="flex w-full items-center justify-center rounded-xl bg-[#D62E5E] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#b91d4a] disabled:opacity-50"
                                >
                                    {isConnecting ? "Conectando..." : isConnected ? "Atualizar Permissões" : "Reconectar Agora"}
                                </button>

                                {isConnected && (
                                    <button
                                        onClick={handleDisconnect}
                                        disabled={isDisconnecting || isConnecting}
                                        className="flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        {isDisconnecting ? "Desconectando..." : "Desconectar Conta"}
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Estado: Sem Perfil (Novo Usuário) */
                        <div className="flex flex-col items-center p-8 text-center">
                            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-pink-50">
                                <FaInstagram className="h-8 w-8 text-[#D62E5E]" />
                            </div>

                            <h2 className="text-lg font-semibold text-gray-900">Conectar Conta</h2>
                            <p className="mt-2 text-sm text-gray-500">
                                Vincule sua conta profissional do Instagram para acessar métricas e insights exclusivos.
                            </p>

                            <div className="mt-8 w-full">
                                <button
                                    onClick={handleReconnect}
                                    disabled={isConnecting}
                                    className="flex w-full items-center justify-center rounded-xl bg-[#D62E5E] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#b91d4a] disabled:opacity-50"
                                >
                                    {isConnecting ? "Iniciando..." : "Conectar com Facebook"}
                                </button>
                            </div>

                            <p className="mt-4 text-xs text-gray-400">
                                Requer conta Profissional ou Criador vinculada a uma Página do Facebook.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer / Ajuda */}
                <div className="text-center">
                    <a href="/dashboard/instagram/faq" className="text-xs font-medium text-gray-400 hover:text-gray-600 hover:underline">
                        Precisa de ajuda com a conexão?
                    </a>
                </div>

                {/* Toast de Erro */}
                {connectError && (
                    <div className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-600">
                        {connectError}
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}
