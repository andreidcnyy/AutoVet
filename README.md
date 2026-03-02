# 🐾 AutoVet - Hybrid Veterinary Management System

**Version:** 1.0  
**Owner:** AutoVet Development Team  

---

## 📖 1. Product Summary
AutoVet is a comprehensive, hybrid veterinary clinic management system designed to streamline scheduling, medical record management, invoicing, and inventory control. It ensures operational continuity with an offline-first architecture, allowing clinics to function without internet access while seamlessly syncing to the cloud when a connection is restored. 

The system consists of three main pillars:
1. 🌐 **Cloud-Based Web Portal:** For pet owners to book appointments and manage profiles.
2. 💻 **Local Desktop System:** An offline-first application for clinic staff to manage daily operations.
3. 🤖 **AI-Powered Forecasting Module:** intelligent stock prediction to prevent inventory shortages.

---

## 🎯 2. Goals & Objectives

### Business Goals
*   Reduce administrative workload
*   Minimize inventory stockouts
*   Improve client booking experience
*   Increase operational efficiency

### User Goals
*   Pet owners can easily book appointments online
*   Staff can manage records quickly and accurately
*   Clinic can accurately predict inventory needs

---

## 👥 3. Target Users
*   👨‍⚕️ **Veterinarians**
*   🏢 **Clinic Administrators**
*   🐶 **Pet Owners**

---

## 🚀 4. Product Scope

### 4.1 Web-Based System (Cloud)
**Core Features:**
*   User registration & login
*   Pet profile management
*   Appointment booking & history
*   Structured chatbot (FAQ-based)
*   Vaccination reminders

*(Out of Scope: Medical diagnosis, online consultation, payment gateway - optional future feature)*

### 4.2 Local-Based System (Clinic)
**Core Features:**
*   Patient record & medical history management
*   Automated invoicing
*   Inventory management
*   AI stock forecasting (predicts stock levels, suggests reorder timing, low-stock alerts)
*   Offline functionality with internet-restored cloud syncing

*(Out of Scope: AI does NOT make medical decisions)*

---

## ⚙️ 5. Functional Requirements

### Web Portal
*   Users can create accounts and book available time slots.
*   System prevents double booking.
*   Appointment requests sync to local system.
*   Chatbot responds to predefined queries.

### Local System
*   Staff can create/edit patient records.
*   System automatically deducts inventory after transactions.
*   Staff can generate printable invoices.
*   AI module generates stock forecast reports.
*   System works flawlessly without internet and syncs with cloud when available.

---

## 📊 6. Non-Functional Requirements
*   **Performance:** Page loads < 3 seconds; Appointment syncs < 5 seconds.
*   **Security:** Role-based access control (RBAC), Encrypted API communication, Local database not publicly accessible.
*   **Reliability:** Offline-first design with automatic resynchronization.
*   **Usability:** Dashboard-based interface, minimal clicks per transaction, clear navigation structure.

---

## 💻 7. Technical Stack

### Web System (Cloud)
*   **Frontend:** React.js (or HTML/CSS/JS)
*   **Backend:** Laravel (or PHP Native)
*   **Database:** MySQL (Cloud Hosted)

### Local System (Clinic)
*   **Backend:** PHP (XAMPP)
*   **Database:** MySQL (Local)

### AI Module
*   **Language & Libs:** Python, Scikit-Learn, Pandas
*   **Model:** Linear Regression

### API Bridge
*   REST API, JSON, cURL

---

## 📈 8. Key Success Metrics
*   ✅ 30% reduction in appointment processing time
*   ✅ Reduced inventory stockouts
*   ✅ Positive user satisfaction rating
*   ✅ Faster record retrieval time

---

## 🔮 9. Future Enhancements
*   📱 Mobile app version
*   💳 Payment integration
*   💬 SMS notifications
*   🧠 Advanced AI forecasting models
*   📊 Analytics dashboard

---

## 🛡️ 10. Cybersecurity & Data Protection Measures

### 10.1 Authentication & Access Control
*   **RBAC Roles:** Admin, Veterinarian, Staff, Pet Owner.
*   **Secure Login:** Password hashing via bcrypt/Argon2. Strong password policies (min 8 chars, alphanumeric + symbols). Account lockout after 5 failed attempts.
*   **Session Management:** Secure tokens, auto-logout after 15–30 mins of inactivity, session ID regeneration post-login.

### 10.2 Data Encryption
*   **In Transit:** All traffic secured via HTTPS (SSL/TLS). API comms encrypted. JSON responses validated.
*   **At Rest:** Sensitive fields (PII, contact details) encrypted in the DB. Local database restricted to internal networks.

### 10.3 API Security (Sync Bridge)
*   JWT tokens or API authentication keys.
*   Request validation, unauthorized cURL prevention, rate limiting, and sync activity logging.

### 10.4 Database Security
*   Disabled remote root access. Strong credentials.
*   Separated users per system (web vs local).
*   Encrypted daily incremental & weekly full backups.

### 10.5 Attack Prevention
*   **SQLi:** Prepared statements (PDO / ORM).
*   **XSS:** Escaped outputs, sanitized inputs.
*   **CSRF:** Tokens in all forms.
*   **File Uploads:** Type/size restrictions and malicious file scanning.

### 10.6 Local System & Privacy
*   Firewall enabled, unnecessary ports disabled in XAMPP, LAN-only access, regular antivirus scans.
*   **Compliance:** Complete adherence to the Philippine Data Privacy Act of 2012 (RA 10173), ensuring minimal data collection and right to deletion.

### 10.7 AI & Disaster Recovery
*   AI models restricted from external internet access. Regulated training data.
*   Disaster Recovery includes daily local backups, cloud redundancy, and quarterly recovery testing.
