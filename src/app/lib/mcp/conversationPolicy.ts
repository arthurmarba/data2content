import type { McpAccountState } from "./accountState";

export type McpReminderFrequency =
  | "every_response"
  | "when_private_context_would_help"
  | "once_per_conversation"
  | "none";

export interface McpConversationPolicy {
  schemaVersion: "conversation_policy_v1";
  accountState: McpAccountState["reason"];
  availableContext: "aggregate_only" | "north_and_aggregate" | "private_and_aggregate";
  onboardingPrompt: string | null;
  closingReminder: {
    frequency: McpReminderFrequency;
    message: string | null;
    url: string | null;
  };
  instagram: {
    requiredForPrivateCreatorAnalysis: true;
    connected: boolean;
    optionalForOtherMembershipBenefits: true;
    connectUrl: string | null;
    explanation: string;
  };
  community: {
    included: boolean;
    inviteFrequency: "once_per_conversation" | "none";
    inviteMessage: string | null;
    joinUrl: string | null;
  };
  commercialBoundary: {
    mentionSubscription: false;
    directToCheckout: false;
    profileIsInformationalDestination: true;
  };
}

interface McpConversationPolicyUrls {
  profileUrl: string;
  instagramConnectUrl: string;
  communityJoinUrl: string;
}

const NORTH_PROMPT =
  "Para começar, quero entender o seu Norte: quem você é como creator, sobre o que deseja falar " +
  "e que transformação quer gerar para quem acompanha você?";

export function buildMcpConversationPolicy(
  accountState: McpAccountState,
  urls: McpConversationPolicyUrls,
): McpConversationPolicy {
  const onboardingPrompt = accountState.northDeclared ? null : NORTH_PROMPT;

  if (accountState.accessLevel === "free") {
    return {
      schemaVersion: "conversation_policy_v1",
      accountState: accountState.reason,
      availableContext: accountState.northDeclared ? "north_and_aggregate" : "aggregate_only",
      onboardingPrompt,
      closingReminder: {
        frequency: "every_response",
        message:
          "Seu perfil personalizado Data2Content reúne seu Norte e mostra como contextualizar " +
          "as respostas com seus próprios conteúdos.",
        url: urls.profileUrl,
      },
      instagram: {
        requiredForPrivateCreatorAnalysis: true,
        connected: accountState.instagramConnected,
        optionalForOtherMembershipBenefits: true,
        connectUrl: null,
        explanation:
          "A análise particular de métricas, cenários, ganchos, roteiros, tom de voz, duração, " +
          "assuntos, dias e horários exige que o Instagram esteja conectado.",
      },
      community: {
        included: false,
        inviteFrequency: "none",
        inviteMessage: null,
        joinUrl: null,
      },
      commercialBoundary: {
        mentionSubscription: false,
        directToCheckout: false,
        profileIsInformationalDestination: true,
      },
    };
  }

  const instagramConnectUrl = accountState.instagramConnected ? null : urls.instagramConnectUrl;
  const communityJoinUrl = accountState.communityInvitePending ? urls.communityJoinUrl : null;

  return {
    schemaVersion: "conversation_policy_v1",
    accountState: accountState.reason,
    availableContext: accountState.instagramConnected
      ? "private_and_aggregate"
      : accountState.northDeclared
        ? "north_and_aggregate"
        : "aggregate_only",
    onboardingPrompt,
    closingReminder: accountState.instagramConnected
      ? {
          frequency: "none",
          message: null,
          url: null,
        }
      : {
          frequency: "when_private_context_would_help",
          message:
            "Para eu também analisar o que funciona nos seus próprios conteúdos — incluindo " +
            "cenário, gancho, roteiro, tom de voz, duração, assunto, dia e horário — conecte seu " +
            "Instagram quando quiser. A conexão é opcional para os outros benefícios Data2Content.",
          url: instagramConnectUrl,
        },
    instagram: {
      requiredForPrivateCreatorAnalysis: true,
      connected: accountState.instagramConnected,
      optionalForOtherMembershipBenefits: true,
      connectUrl: instagramConnectUrl,
      explanation: accountState.instagramConnected
        ? "A inteligência particular dos próprios conteúdos está disponível."
        : "A inteligência particular dos próprios conteúdos ficará disponível após a conexão do Instagram.",
    },
    community: {
      included: true,
      inviteFrequency: communityJoinUrl ? "once_per_conversation" : "none",
      inviteMessage: communityJoinUrl
        ? "Seu acesso também inclui a comunidade Data2Content. Quando quiser entrar, use este acesso."
        : null,
      joinUrl: communityJoinUrl,
    },
    commercialBoundary: {
      mentionSubscription: false,
      directToCheckout: false,
      profileIsInformationalDestination: true,
    },
  };
}
