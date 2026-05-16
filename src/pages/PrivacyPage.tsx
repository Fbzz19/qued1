import { ArrowLeft } from 'lucide-react';

interface PrivacyPageProps { onBack: () => void; }

const SECTIONS = [
  {
    title: '1. Who We Are',
    body: `Qued is a film and television tracking platform operated at myqued.com. We are the data controller for all personal data processed in connection with the Service.\n\nIf you have any questions about this Privacy Policy or how we handle your data, please contact us at:\n\nhello@myqued.com`,
  },
  {
    title: '2. What Data We Collect',
    body: `We collect the following categories of personal data:\n\nAccount data: Your email address and username when you register. Optional profile data including a display name, biography, and avatar image.\n\nActivity data: Films and TV shows you log, your ratings (0.5–5 stars), reviews you write, your watchlist, diary entries, follows, and likes.\n\nPayment data: If you subscribe to Qued Pro, payment processing is handled entirely by Stripe. We store your Stripe customer ID and subscription ID, but we never store your card details.\n\nTechnical data: IP address, browser type, device type, pages visited, and session duration. This data is collected via analytics tools solely for service improvement.\n\nCommunication data: Messages you send to other users within the platform, and any emails you send to hello@myqued.com.`,
  },
  {
    title: '3. How We Collect Data',
    body: `We collect data in the following ways:\n\n• Directly from you when you create an account, complete your profile, log films, write reviews, or contact us\n• Automatically when you use the Service through cookies, session tokens, and server logs\n• Via Stripe when you subscribe to Qued Pro (Stripe processes payments and shares limited subscription data with us)\n• Via The Movie Database (TMDB) API for film and TV metadata — no personal data is sent to TMDB`,
  },
  {
    title: '4. Why We Collect Data (Legal Basis)',
    body: `We process your personal data for the following purposes and on the following legal bases:\n\nContract performance: To provide you with the Qued Service, including account management, personalised tracking, and social features.\n\nLegitimate interests: To improve the Service, detect and prevent abuse, maintain security, and analyse usage patterns.\n\nConsent: To send you optional emails (such as the weekly digest or annual rewind notification) — you may withdraw consent at any time.\n\nLegal obligation: To comply with applicable laws and respond to lawful requests from authorities.`,
  },
  {
    title: '5. How We Store Your Data',
    body: `Your data is stored on Supabase, a cloud database platform. Data is encrypted at rest and in transit using industry-standard TLS encryption. Supabase infrastructure is hosted in the European Union, ensuring compliance with GDPR data residency requirements.\n\nWe implement Row Level Security (RLS) so that database queries are scoped to the authenticated user, preventing cross-user data access. Your password is hashed using bcrypt and is never stored in plaintext.`,
  },
  {
    title: '6. Third-Party Services',
    body: `We use the following third-party services, each subject to their own privacy policies:\n\nThe Movie Database (TMDB): Provides film and TV metadata, posters, and cast information. No personal data is sent to TMDB.\n\nSupabase: Database, authentication, and file storage. Supabase processes data in accordance with GDPR.\n\nStripe: Payment processing for Qued Pro subscriptions. Stripe is PCI-DSS compliant. We do not store card details.\n\nResend: Transactional email delivery (password reset, notifications). Only your email address is shared.\n\nGoogle Analytics: Website traffic analysis. Only loaded after you give cookie consent. Data is anonymised where possible.\n\nWe do not sell your personal data to any third party, and we do not use your data for advertising purposes.`,
  },
  {
    title: '7. How Long We Keep Your Data',
    body: `We retain your personal data for as long as your account is active. When you delete your account, all associated personal data — including your profile, reviews, diary entries, watchlist, and messages — is permanently deleted from our systems within 30 days.\n\nAnalytics data (Google Analytics) is retained for up to 26 months in accordance with Google's data retention policies.\n\nLegal or compliance records may be retained for longer periods where required by law.`,
  },
  {
    title: '8. Your Rights Under GDPR',
    body: `If you are located in the European Economic Area or the United Kingdom, you have the following rights:\n\nRight of access: You can request a copy of the personal data we hold about you.\n\nRight to rectification: You can correct inaccurate data from your Settings page, or by contacting us.\n\nRight to erasure ("right to be forgotten"): You can delete your account and all associated data from Settings > Data & Privacy > Delete Account.\n\nRight to data portability: You can download all your personal data in JSON and CSV format from Settings > Data & Privacy > Download My Data.\n\nRight to object: You can object to processing based on legitimate interests by contacting us.\n\nRight to restriction: You can request that we restrict processing of your data in certain circumstances.\n\nRight to withdraw consent: Where processing is based on consent (e.g. marketing emails), you can withdraw consent at any time.\n\nTo exercise any right not available directly in the app, please email hello@myqued.com. We will respond within 30 days.`,
  },
  {
    title: '9. Cookies',
    body: `We use the following types of cookies:\n\nEssential cookies: Required to keep you signed in and maintain your session. These cannot be disabled without breaking the Service.\n\nAnalytics cookies (Google Analytics): Used to understand how visitors use the site — pages visited, time on site, traffic sources. These are only loaded after you give explicit consent via the cookie banner. You may withdraw consent at any time by clearing your browser cookies or using your browser's privacy settings.\n\nWe do not use advertising cookies, tracking pixels, or third-party retargeting cookies.`,
  },
  {
    title: '10. Children',
    body: `Qued is not directed at children under 13. We do not knowingly collect personal data from children under 13. If you believe a child under 13 has registered on Qued, please contact us at hello@myqued.com and we will promptly delete their account and data.`,
  },
  {
    title: '11. Changes to This Policy',
    body: `We may update this Privacy Policy from time to time. When we make material changes, we will update the "Last updated" date at the top of this page. For significant changes, we may also notify you by email. Your continued use of Qued after any changes constitutes acceptance of the updated policy.`,
  },
  {
    title: '12. Contact and Complaints',
    body: `For any questions or concerns about this Privacy Policy or how we handle your data, please contact us at:\n\nhello@myqued.com\n\nIf you are not satisfied with our response, you have the right to lodge a complaint with the Information Commissioner's Office (ICO) in the United Kingdom, or the supervisory authority in your country of residence.`,
  },
];

export default function PrivacyPage({ onBack }: PrivacyPageProps) {
  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 80 }} className="animate-fade-in">
      <div style={{ position: 'sticky', top: 56, zIndex: 10, background: 'rgba(0,0,0,.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1a1a1a', padding: '16px clamp(16px,4vw,48px)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontFamily: 'inherit', transition: 'color .2s', flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = '#888')}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1 style={{ margin: 0, color: '#fff', fontSize: 17, fontWeight: 700 }}>Privacy Policy</h1>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px clamp(16px,4vw,48px)' }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 100, padding: '5px 14px', marginBottom: 20 }}>
            <span style={{ color: '#f59e0b', fontSize: 12, fontWeight: 700 }}>Qued — myqued.com</span>
          </div>
          <h2 style={{ margin: '0 0 8px', color: '#fff', fontSize: 'clamp(24px,4vw,36px)', fontWeight: 800, letterSpacing: '-0.5px' }}>Privacy Policy</h2>
          <p style={{ margin: 0, color: '#555', fontSize: 13 }}>Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        {/* GDPR badge */}
        <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 14, padding: '20px 24px', marginBottom: 40 }}>
          <p style={{ margin: 0, color: '#888', fontSize: 14, lineHeight: 1.8 }}>
            This policy explains how Qued collects, uses, and protects your personal data. We are committed to GDPR compliance and your privacy. If you have any questions, contact us at <a href="mailto:hello@myqued.com" style={{ color: '#f59e0b', textDecoration: 'none' }}>hello@myqued.com</a>.
          </p>
        </div>

        {/* Sections */}
        {SECTIONS.map(s => (
          <div key={s.title} style={{ marginBottom: 40, paddingBottom: 40, borderBottom: '1px solid #111' }}>
            <h3 style={{ margin: '0 0 14px', color: '#fff', fontSize: 16, fontWeight: 700 }}>{s.title}</h3>
            <div style={{ color: '#888', fontSize: 14, lineHeight: 1.9, whiteSpace: 'pre-line' }}>{s.body}</div>
          </div>
        ))}

        <p style={{ color: '#333', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
          © {new Date().getFullYear()} Qued. All rights reserved. · <a href="mailto:hello@myqued.com" style={{ color: '#555', textDecoration: 'none' }}>hello@myqued.com</a>
        </p>
      </div>
    </div>
  );
}
