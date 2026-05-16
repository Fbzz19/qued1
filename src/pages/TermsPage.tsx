import { ArrowLeft } from 'lucide-react';

interface TermsPageProps { onBack: () => void; }

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: `By accessing or using Qued ("the Service") at myqued.com, creating an account, or otherwise engaging with the platform, you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms in their entirety, you must not use the Service. These Terms constitute a legally binding agreement between you and Qued.`,
  },
  {
    title: '2. Description of Service',
    body: `Qued is a film and television tracking platform that allows users to log films and shows they have watched, rate and review content, build watchlists, follow other users, and receive AI-powered recommendations. Qued also offers a premium subscription ("Qued Pro") with enhanced features. The Service relies on film and TV data provided by The Movie Database (TMDB) under their terms of use.`,
  },
  {
    title: '3. Account Registration and Eligibility',
    body: `You must be at least 13 years old to create an account or use Qued. By registering, you confirm that you meet this age requirement. If you are under 18, you confirm that you have obtained parental or guardian consent.\n\nYou agree to provide accurate, current, and complete information during registration. You are responsible for maintaining the confidentiality of your password and for all activity that occurs under your account. You must notify us immediately at hello@myqued.com if you suspect unauthorised access to your account.\n\nYou may not create an account using another person's identity or contact information, or using a username that is offensive, impersonating, misleading, or that violates any third-party rights.`,
  },
  {
    title: '4. Acceptable Use Policy',
    body: `You agree to use Qued only for lawful purposes and in accordance with these Terms. You must not:\n\n• Post content that is abusive, hateful, discriminatory, threatening, or harassing\n• Impersonate any person, organisation, or entity\n• Post spam, unsolicited commercial messages, or repetitive content\n• Attempt to gain unauthorised access to any part of the Service\n• Use automated scripts, bots, or scrapers to access the Service\n• Introduce malicious code, viruses, or harmful software\n• Engage in any activity that disrupts or degrades the performance of the Service\n• Use the Service to violate any applicable law or regulation`,
  },
  {
    title: '5. Prohibited Content',
    body: `The following content is strictly prohibited on Qued:\n\n• Offensive language, slurs, or hate speech targeting any individual or group\n• Adult, explicit, or sexually suggestive content\n• Content that harasses, bullies, or intimidates other users\n• Personal information of other individuals posted without their consent\n• Spoilers for films or TV shows shared without appropriate spoiler warnings\n• Content that infringes any copyright, trademark, or other intellectual property right\n• Misleading or false information presented as factual\n• Any content that violates applicable law\n\nQued reserves the right to remove any content that violates these policies and to suspend or terminate accounts responsible for such content.`,
  },
  {
    title: '6. User Generated Content',
    body: `You retain ownership of all content you create and post on Qued, including reviews, ratings, profile information, and list names ("User Content"). By posting User Content, you grant Qued a non-exclusive, royalty-free, worldwide licence to display, reproduce, and distribute that content as part of the Service and for the purposes of operating and promoting Qued.\n\nYou represent and warrant that your User Content does not infringe any third-party rights and complies with these Terms. You acknowledge that User Content you mark as public may be visible to other users and to visitors who are not registered members.`,
  },
  {
    title: '7. Intellectual Property',
    body: `The Qued name, logo, brand, and all original content created by Qued are owned by Qued and are protected by copyright, trademark, and other intellectual property laws. You may not use Qued's branding or intellectual property without prior written consent.\n\nFilm and TV data, posters, and imagery are provided by The Movie Database (TMDB). This product uses the TMDB API but is not endorsed or certified by TMDB. All film and TV metadata remains the property of its respective rights holders.`,
  },
  {
    title: '8. Privacy and Data',
    body: `Your use of the Service is also governed by our Privacy Policy, which is incorporated into these Terms by reference. By using Qued, you consent to the collection and use of your data as described in our Privacy Policy. Please read the Privacy Policy carefully before using the Service.`,
  },
  {
    title: '9. Subscription and Payments — Qued Pro',
    body: `Qued Pro is a paid subscription available at £3.99 per month. Subscriptions are processed and managed by Stripe. By subscribing, you agree to Stripe's terms of service in addition to these Terms.\n\nYour subscription will renew automatically each month unless you cancel it before the renewal date. You can cancel your subscription at any time from your account Settings. Upon cancellation, you will retain Pro access until the end of the current billing period; no partial refunds are provided for unused time.\n\nQued reserves the right to change subscription pricing with reasonable notice. If you do not accept a price change, you may cancel your subscription before the change takes effect.\n\nIf you believe you have been charged in error, contact us at hello@myqued.com within 14 days and we will investigate.`,
  },
  {
    title: '10. Termination',
    body: `Qued reserves the right to suspend, restrict, or permanently terminate your account at any time, with or without prior notice, if we determine that you have violated these Terms, engaged in harmful behaviour, or if required to do so by law.\n\nYou may delete your account at any time from the Settings page. Upon deletion, your profile and associated data will be permanently removed from our systems in accordance with our Privacy Policy.\n\nTermination of your account does not affect any rights or obligations that arose prior to termination.`,
  },
  {
    title: '11. Limitation of Liability',
    body: `The Service is provided "as is" without any warranties of any kind, express or implied. Qued does not warrant that the Service will be uninterrupted, error-free, or free from viruses or harmful components.\n\nTo the fullest extent permitted by law, Qued shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Service, including but not limited to loss of data, loss of profits, or loss of business opportunities.\n\nNothing in these Terms excludes or limits our liability for death or personal injury caused by our negligence, or for fraud or fraudulent misrepresentation.`,
  },
  {
    title: '12. Governing Law',
    body: `These Terms shall be governed by and construed in accordance with the laws of England and Wales. Any disputes arising from or in connection with these Terms or the Service shall be subject to the exclusive jurisdiction of the courts of England and Wales.`,
  },
  {
    title: '13. Changes to These Terms',
    body: `We may update these Terms of Service from time to time to reflect changes in our practices, the law, or the Service. When we make material changes, we will update the "Last updated" date at the top of this page and may notify you by email or via a notice on the Service. Your continued use of Qued after any changes constitutes your acceptance of the revised Terms.`,
  },
  {
    title: '14. Contact',
    body: `If you have any questions about these Terms of Service, or if you wish to report a violation, please contact us at:\n\nhello@myqued.com\n\nQued — myqued.com`,
  },
];

export default function TermsPage({ onBack }: TermsPageProps) {
  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 80 }} className="animate-fade-in">
      <div style={{ position: 'sticky', top: 56, zIndex: 10, background: 'rgba(0,0,0,.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1a1a1a', padding: '16px clamp(16px,4vw,48px)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontFamily: 'inherit', transition: 'color .2s', flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = '#888')}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1 style={{ margin: 0, color: '#fff', fontSize: 17, fontWeight: 700 }}>Terms of Service</h1>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px clamp(16px,4vw,48px)' }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 100, padding: '5px 14px', marginBottom: 20 }}>
            <span style={{ color: '#f59e0b', fontSize: 12, fontWeight: 700 }}>Qued — myqued.com</span>
          </div>
          <h2 style={{ margin: '0 0 8px', color: '#fff', fontSize: 'clamp(24px,4vw,36px)', fontWeight: 800, letterSpacing: '-0.5px' }}>Terms of Service</h2>
          <p style={{ margin: 0, color: '#555', fontSize: 13 }}>Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        {/* Intro */}
        <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 14, padding: '20px 24px', marginBottom: 40 }}>
          <p style={{ margin: 0, color: '#888', fontSize: 14, lineHeight: 1.8 }}>
            These Terms of Service govern your use of Qued. Please read them carefully. By using Qued you agree to these terms. If you have any questions, contact us at <a href="mailto:hello@myqued.com" style={{ color: '#f59e0b', textDecoration: 'none' }}>hello@myqued.com</a>.
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
