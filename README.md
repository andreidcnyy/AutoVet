🐾 AutoVet

Version: 1.0
Owner: AutoVet Development Team

AutoVet is a hybrid veterinary clinic management system designed to streamline clinic operations while maintaining offline reliability.

It consists of:

🌐 Cloud-Based Web Portal (for Pet Owners)

💻 Local Desktop System (for Clinic Staff)

🤖 AI-Powered Inventory Forecasting Module

AutoVet improves scheduling, medical record management, invoicing, and inventory control — while ensuring secure synchronization between local and cloud environments.

📌 Product Overview

AutoVet is built with an offline-first architecture. Clinics can operate without internet connectivity, and data automatically synchronizes with the cloud once a connection is available.

The system does NOT perform medical diagnosis or online consultations.
The AI module is strictly for inventory forecasting only.

🎯 Goals & Objectives
Business Goals

Reduce administrative workload

Minimize inventory stockouts

Improve booking experience

Increase operational efficiency

User Goals

Pet owners can easily book appointments online

Staff can manage patient records efficiently

Clinic can predict and prevent inventory shortages

👥 Target Users

Veterinarians

Clinic Administrators

Pet Owners

🏗 System Architecture
🌐 Web-Based System (Cloud)
Core Features

User Registration & Login

Pet Profile Management

Appointment Booking

Appointment History

Structured FAQ Chatbot

Vaccination Reminders

Out of Scope

Medical diagnosis

Online consultation

Payment gateway (future feature)

💻 Local-Based System (Clinic)
Core Features

Patient Record Management

Medical History Tracking

Automated Invoice Generation

Inventory Management

AI Stock Forecasting

Offline-First Functionality

Automatic Cloud Sync

AI Scope

Predict stock levels using historical data

Suggest reorder timing

Provide low-stock alerts

Does NOT make medical decisions

⚙ Functional Requirements
Web Portal

Users can create accounts

Users can book available time slots

Prevent double booking

Sync appointment requests to local system

Chatbot responds to predefined queries

Local System

Staff can create/edit patient records

Automatic inventory deduction after transactions

Printable invoice generation

AI stock forecast reports

Works without internet

Syncs with cloud when internet is available

🚀 Non-Functional Requirements
Performance

Page loads under 3 seconds

Appointment sync under 5 seconds

Security

Role-Based Access Control (RBAC)

Encrypted API communication

Local database not publicly accessible

Reliability

Offline-first design

Automatic resynchronization

Usability

Dashboard-based interface

Minimal clicks per transaction

Clear navigation structure

🧱 Technical Stack
Web System

Frontend: React.js

Backend: Laravel (PHP)

Database: Cloud-Hosted MySQL

Local System

Backend: PHP (XAMPP)

Database: Local MySQL

AI Module

Python

Pandas

Scikit-Learn

Linear Regression

API Bridge

REST API

JSON

cURL

🔐 Cybersecurity & Data Protection

AutoVet complies with the 🇵🇭 Philippine Data Privacy Act of 2012 (RA 10173).

1️⃣ Authentication & Access Control

Role-Based Access Control (Admin, Veterinarian, Staff, Pet Owner)

Password hashing (bcrypt / Argon2)

Strong password policy

Account lockout after 5 failed attempts

Secure session tokens

Auto logout after inactivity

Session ID regeneration after login

2️⃣ Data Encryption
Data in Transit

HTTPS (SSL/TLS) enforced

Secure API communication

JSON validation server-side

Data at Rest

Encrypted sensitive fields

Restricted local database access

3️⃣ API Security

JWT or API key authentication

Rate limiting

Request validation

Sync activity logging

4️⃣ Database Security

Disable remote root access

Strong credentials

Separate DB users (Web vs Local)

Daily incremental backups

Weekly full backups

Encrypted backups

5️⃣ Attack Prevention

✔ SQL Injection — Prepared statements (PDO/ORM)
✔ XSS — Output escaping & input sanitization
✔ CSRF — CSRF tokens
✔ File Upload Protection — File restriction & scanning

6️⃣ Local System Protection

Installation limited to authorized clinic computers

Firewall enabled

Restricted LAN access

Disabled unnecessary XAMPP ports

Regular antivirus scanning

7️⃣ Logging & Monitoring

Audit logs maintained for:

Login attempts

Record modifications

Inventory updates

AI forecast generation

Admin dashboard includes log viewer and suspicious activity alerts.

8️⃣ AI Security

No internet access

Forecasting data validated before training

Prevent manipulation of historical data

AI retraining restricted to Admin role

9️⃣ Disaster Recovery Plan

Daily local backups

Cloud redundancy

Quarterly recovery testing

Documented system restoration guide

📊 Key Success Metrics

30% reduction in appointment processing time

Reduced inventory stockouts

Positive user satisfaction rating

Faster record retrieval time

🔮 Future Enhancements

SMS Notifications

Payment Integration

Mobile App Version

Advanced AI Forecasting Model

Analytics Dashboard

🏁 Installation Overview (Development)
Web System
git clone <repository>
composer install
npm install
php artisan migrate
php artisan serve
Local System (XAMPP)

Install XAMPP

Place project in htdocs

Configure local MySQL database

Import database schema

Start Apache & MySQL

AI Module
pip install pandas scikit-learn
python train_model.py
📄 License

Proprietary – AutoVet Development Team
