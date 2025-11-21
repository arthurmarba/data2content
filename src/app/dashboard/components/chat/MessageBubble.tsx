import React from 'react';
import { useRouter } from 'next/navigation';
import { Message } from './types';
import { renderFormatted } from './chatUtils';

interface MessageBubbleProps {
    message: Message;
    onUpsellClick?: () => void;
    onConnectInstagram: () => void;
}

export const MessageBubble = React.memo(function MessageBubble({
    message,
    onUpsellClick,
    onConnectInstagram,
}: MessageBubbleProps) {
    const router = useRouter();
    const isUser = message.sender === 'user';

    return (
        <li className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex flex-col gap-1.5 w-full ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                    className={[
                        isUser
                            ? 'max-w-[92%] sm:max-w-[75%] rounded-2xl rounded-tr-sm bg-brand-primary text-white shadow-sm px-3.5 py-2.5'
                            : 'max-w-[92%] sm:max-w-[80%] lg:max-w-[72ch] text-gray-800 px-1 text-[15px] leading-7',
                    ].join(' ')}
                >
                    <div className={isUser ? 'text-white/95' : undefined}>
                        {renderFormatted(message.text, isUser ? 'inverse' : 'default')}
                    </div>
                    {message.cta && (
                        <div className={`mt-3 pt-3 ${isUser ? 'border-t border-white/25' : 'border-t border-gray-200'}`}>
                            <button
                                className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors w-full sm:w-auto ${isUser
                                    ? 'bg-white text-brand-primary hover:bg-brand-magenta-soft'
                                    : 'bg-brand-primary text-white hover:bg-brand-primary-dark'
                                    }`}
                                onClick={() => {
                                    if (message.cta?.action === 'connect_instagram') return onConnectInstagram();
                                    if (message.cta?.action === 'go_to_billing') {
                                        if (onUpsellClick) return onUpsellClick();
                                        return router.push('/dashboard/billing');
                                    }
                                }}
                            >
                                {message.cta.label}
                            </button>
                        </div>
                    )}
                </div>
                <span className="text-[11px] text-gray-400 px-1">
                    {isUser ? 'Você' : 'Mobi IA'}
                </span>
            </div>
        </li>
    );
});
