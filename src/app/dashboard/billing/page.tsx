import BillingPanel from './BillingPanel';
import { ProfileSettingsPage } from '@/app/dashboard/boards/components/videoUpload/appPreview/ProfileSettingsPage';

export default function BillingPage() {
  return (
    <ProfileSettingsPage
      title="Seu plano"
      backHref="/dashboard/boards/mobile-strategic-profile"
      backLabel="Voltar ao Perfil"
    >
      <BillingPanel />
    </ProfileSettingsPage>
  );
}
