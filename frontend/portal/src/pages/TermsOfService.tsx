import { Link } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import DarkModeToggle from "../components/DarkModeToggle";
import logo from "../assets/logo.png";

export default function TermsOfService() {
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
          <h1 className="text-4xl font-black text-zinc-800 dark:text-zinc-100">Terms of Service</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">Last updated: May 18, 2026</p>
        </div>

        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-6 text-zinc-600 dark:text-zinc-400 leading-relaxed">

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Pet Wellness Animal Clinic patient portal ("Service"), you agree to be bound
              by these Terms of Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">2. Description of Service</h2>
            <p>
              The Pet Wellness Animal Clinic portal is a web-based platform that allows registered pet owners to:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Book and manage veterinary appointments online</li>
              <li>View their pets' health records and medical history</li>
              <li>Receive appointment reminders and health notifications</li>
              <li>Communicate with their veterinary care team</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">3. Account Registration</h2>
            <p>
              To use the Service, you must create an account by providing accurate, complete, and current information.
              You are responsible for maintaining the confidentiality of your account credentials and for all activities
              that occur under your account. You must notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide false or misleading information about yourself or your pets</li>
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Use the Service to transmit harmful or offensive content</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">5. Medical Disclaimer</h2>
            <p>
              The information provided through this portal is for administrative and informational purposes only and
              does not constitute veterinary medical advice. Always consult with a licensed veterinarian for diagnosis
              and treatment of your pet. In case of a veterinary emergency, contact our clinic directly or your
              nearest emergency veterinary facility.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">6. Appointment Cancellation Policy</h2>
            <p>
              We request at least 24 hours' notice for appointment cancellations. Repeated no-shows or last-minute
              cancellations may affect your ability to book future appointments through the portal.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">7. Intellectual Property</h2>
            <p>
              All content, trademarks, and data on this Service, including but not limited to text, graphics, logos,
              and software, are the property of Pet Wellness Animal Clinic and are protected by applicable intellectual
              property laws.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">8. Limitation of Liability</h2>
            <p>
              Pet Wellness Animal Clinic shall not be liable for any indirect, incidental, special, or consequential
              damages arising out of or in connection with your use of the Service. Our total liability shall not
              exceed the amount paid by you for the Service in the preceding 12 months.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">9. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time for violation of these Terms or
              for any other reason at our sole discretion. You may also delete your account at any time by contacting
              our support team.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">10. Changes to Terms</h2>
            <p>
              We may update these Terms of Service from time to time. We will notify registered users of significant
              changes via email or in-app notification. Continued use of the Service after changes constitutes
              acceptance of the updated terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">11. Contact Us</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <div className="bg-white dark:bg-dark-card rounded-xl p-4 border border-zinc-200 dark:border-dark-border font-medium">
              <p className="font-black text-zinc-800 dark:text-zinc-100">Pet Wellness Animal Clinic</p>
              <p>Email: support@petwellness.com</p>
              <p>Website: <a href="https://petwellness-web.vercel.app" className="text-brand-600 hover:underline">petwellness-web.vercel.app</a></p>
            </div>
          </section>
        </div>

        <div className="border-t border-zinc-200 dark:border-dark-border pt-6 flex flex-wrap gap-4 text-sm">
          <Link to="/privacy-policy" className="font-bold text-brand-600 hover:text-brand-700">Privacy Policy</Link>
          <Link to="/register" className="font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Back to Register</Link>
          <Link to="/login" className="font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
