import { Link } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import DarkModeToggle from "../components/DarkModeToggle";
import logo from "../assets/logo.png";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-dark-bg transition-colors duration-300">

      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-dark-card/80 backdrop-blur border-b border-zinc-200 dark:border-dark-border">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="w-8 h-8 object-contain" />
            <span className="font-black text-zinc-800 dark:text-zinc-100 text-sm uppercase tracking-tight">
              Pet Wellness Animal Clinic
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/register"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border text-zinc-600 dark:text-zinc-400 font-bold hover:text-brand-500 transition-all shadow-sm active:scale-95 text-sm">
              <FiArrowLeft className="h-4 w-4" /> Back
            </Link>
            <DarkModeToggle />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">

        <div className="space-y-2">
          <h1 className="text-4xl font-black text-zinc-800 dark:text-zinc-100">Privacy Policy</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">Last updated: May 19, 2026</p>
        </div>

        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-6 text-zinc-600 dark:text-zinc-400 leading-relaxed">

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">1. Introduction</h2>
            <p>
              Pet Wellness Animal Clinic ("we," "our," or "us") is committed to protecting your personal information.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use
              our patient portal. Please read this policy carefully.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">2. Information We Collect</h2>
            <p>We collect the following types of information:</p>
            <div className="space-y-3">
              <div>
                <p className="font-bold text-zinc-700 dark:text-zinc-300">Personal Information:</p>
                <ul className="list-disc pl-6 space-y-1 mt-1">
                  <li>Full name and contact information (email, phone number)</li>
                  <li>Home address (street, city, province, zip code)</li>
                  <li>Profile photo (if provided)</li>
                  <li>Google account information (if you sign in with Google)</li>
                </ul>
              </div>
              <div>
                <p className="font-bold text-zinc-700 dark:text-zinc-300">Pet & Medical Information:</p>
                <ul className="list-disc pl-6 space-y-1 mt-1">
                  <li>Pet details (name, species, breed, age, weight)</li>
                  <li>Veterinary records and medical history</li>
                  <li>Appointment history and schedules</li>
                  <li>Vaccination records and treatment notes</li>
                </ul>
              </div>
              <div>
                <p className="font-bold text-zinc-700 dark:text-zinc-300">Billing Information:</p>
                <ul className="list-disc pl-6 space-y-1 mt-1">
                  <li>Invoice records for veterinary services rendered</li>
                  <li>Payment status and transaction history</li>
                </ul>
              </div>
              <div>
                <p className="font-bold text-zinc-700 dark:text-zinc-300">Usage Information:</p>
                <ul className="list-disc pl-6 space-y-1 mt-1">
                  <li>Device information and IP address</li>
                  <li>Browser type and session duration</li>
                  <li>Pages visited and features used</li>
                  <li>Notification read status and interaction history</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide and manage veterinary care services for your pet</li>
              <li>Process and confirm appointment bookings</li>
              <li>Send appointment reminders and health notifications</li>
              <li>Maintain accurate medical records for your pet</li>
              <li>Generate and display invoices for services rendered</li>
              <li>Send system-wide announcements and operational updates via broadcast notifications</li>
              <li>Communicate important updates about our services</li>
              <li>Improve and optimize the portal experience</li>
              <li>Comply with legal and regulatory obligations</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">4. Portal Access & Authentication</h2>
            <p>
              This portal is exclusively accessible to registered pet owners. Clinic administrators, veterinarians,
              and staff use a separate administration system. Our authentication system actively prevents non-owner
              accounts from accessing the portal, and the credentials you create here are distinct from any clinic
              staff credentials.
            </p>
            <p>
              Authentication tokens are used to maintain your session securely. We do not store your password in
              plain text — passwords are hashed using industry-standard encryption before storage.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">5. Google Sign-In</h2>
            <p>
              If you choose to sign in with Google, we receive your Google profile information including your name,
              email address, and profile photo. We use this information solely to create and manage your account.
              We do not store your Google password or have access to your Google account beyond the information
              explicitly shared during sign-in. Your use of Google Sign-In is also governed by
              Google's <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">Privacy Policy</a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">6. System Broadcast Notifications</h2>
            <p>
              Authorized clinic administrators may send broadcast announcements to portal users and/or visitors of
              our public website. These announcements may contain operational notices, clinic updates, or health
              advisories. We do not use broadcast announcements for commercial marketing. Announcements are
              delivered in-app and do not require your email address to be shared with third parties.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">7. Data Sharing and Disclosure</h2>
            <p>We do not sell your personal information. We may share your information with:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><span className="font-bold">Veterinary Staff:</span> Licensed veterinarians and clinic staff involved in your pet's care</li>
              <li><span className="font-bold">Service Providers:</span> Third-party providers who assist in operating our platform (email delivery, cloud storage)</li>
              <li><span className="font-bold">Legal Requirements:</span> When required by law or to protect the rights and safety of our clinic and clients</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">8. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your personal information, including
              encrypted data transmission (HTTPS), secure token-based authentication, and regular security audits.
              However, no method of transmission over the Internet is 100% secure, and we cannot guarantee
              absolute security.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">9. Data Retention & Account Deletion</h2>
            <p>
              We retain your personal and pet health information for as long as your account is active or as needed
              to provide services. Medical records may be retained for longer periods as required by veterinary
              regulations.
            </p>
            <p>
              When you request account deletion, your account enters a <strong>30-day recovery period</strong> during
              which your data is preserved and you may cancel the deletion by logging back in. After 30 days, your
              account and all associated personal data are permanently and irreversibly deleted. Pet medical records
              required for regulatory compliance may be retained separately in anonymized form.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">10. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your account and personal data (subject to the 30-day recovery period)</li>
              <li>Cancel a pending account deletion within the 30-day window by logging back in</li>
              <li>Opt out of non-essential communications</li>
              <li>Request a copy of your data in a portable format</li>
            </ul>
            <p>To exercise these rights, please contact us using the information below.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">11. Cookies</h2>
            <p>
              Our portal uses cookies and similar tracking technologies to maintain your session and improve your
              experience. You can control cookie settings through your browser, though disabling certain cookies
              may affect portal functionality.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">12. Children's Privacy</h2>
            <p>
              Our Service is not intended for use by individuals under the age of 18. We do not knowingly collect
              personal information from minors. If you believe a minor has provided us with personal information,
              please contact us immediately.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">13. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. We will notify you of significant changes via email
              or a prominent notice on our portal. Your continued use of the Service after changes become effective
              constitutes acceptance of the revised policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">14. Contact Us</h2>
            <p>
              For questions about this Privacy Policy or to exercise your data rights, contact us at:
            </p>
            <div className="bg-white dark:bg-dark-card rounded-xl p-4 border border-zinc-200 dark:border-dark-border font-medium space-y-1">
              <p className="font-black text-zinc-800 dark:text-zinc-100">Pet Wellness Animal Clinic</p>
              <p>Email: badetvelasquez@gmail.com</p>
              <p>Phone: +63 933 461 7957</p>
              <p>Address: Blk 10 Lot 2D Dahlia Ave, West Fairview, Quezon City, Philippines</p>
            </div>
          </section>
        </div>

        <div className="border-t border-zinc-200 dark:border-dark-border pt-6 flex flex-wrap gap-4 text-sm">
          <Link to="/terms" className="font-bold text-brand-600 hover:text-brand-700">Terms of Service</Link>
          <Link to="/register" className="font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Back to Register</Link>
          <Link to="/login" className="font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
