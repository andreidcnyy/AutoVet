🐾 AutoVet

Hybrid Veterinary Clinic Management System
Version 1.0

AutoVet is a hybrid veterinary clinic management platform built to combine cloud convenience, offline reliability, and AI-powered inventory forecasting into one unified ecosystem.

Designed for real-world clinic environments, AutoVet ensures uninterrupted operations — even during internet outages — while still providing modern digital experiences for pet owners.

🌍 System Overview

AutoVet is composed of three synchronized components:

Layer	Purpose
🌐 Cloud Web Portal	Client-facing system for appointments and pet management
💻 Local Clinic System	Offline-first operational system for staff
🤖 AI Forecasting Module	Predictive inventory analytics engine

This hybrid approach ensures:

Continuous clinic operations (offline-first)

Secure synchronization with the cloud

Data-driven operational planning

Compliance with Philippine data protection laws

🧱 Architecture

AutoVet uses a modular hybrid architecture.

Pet Owner (Web Portal - React)
        ↓
Cloud API (Laravel)
        ↓
Cloud MySQL Database
        ↕ Secure REST Sync (HTTPS + JWT)
Local PHP System (XAMPP)
        ↓
Local MySQL Database
        ↓
AI Forecasting Module (Python)
Design Principles

Offline-first architecture

Secure-by-default implementation

Role-based data access

Modular separation of concerns

API-driven communication

🌐 Cloud Web Portal

Built for pet owners to interact digitally with the clinic.

Features

Secure user registration & login

Multi-pet profile management

Real-time appointment booking

Double-booking prevention logic

Structured FAQ chatbot

Automated vaccination reminders

Tech Stack

React.js

Laravel (REST API)

Cloud-hosted MySQL

💻 Local Clinic System

Designed for high-speed clinic operations with full offline capability.

Core Features

Electronic Medical Records (EMR)

Medical history tracking

Automated invoice generation

Automatic inventory deduction

Low-stock alerts

Full offline functionality

Automatic cloud synchronization

Tech Stack

PHP (XAMPP)

Local MySQL

cURL-based secure API communication

🤖 AI Forecasting Module

AutoVet includes a controlled AI module that predicts future inventory requirements.

Technology

Python

Pandas

Scikit-Learn

Linear Regression (initial version)

Capabilities

Analyze historical stock usage

Predict depletion timelines

Suggest reorder timing

Flag potential shortages

⚠️ The AI module:

Does NOT perform medical diagnosis

Does NOT access the external internet

Is restricted to administrative retraining

🔄 Synchronization Engine

When internet connectivity is available:

Local system authenticates with cloud API

Timestamp validation occurs

Data conflicts are resolved

Logs are generated for audit tracking

Security controls include:

HTTPS (SSL/TLS)

JWT/API key authentication

Rate limiting

Request validation middleware

Full sync logging

🔐 Security & Compliance

AutoVet is built with a security-first architecture and aligns with:

🇵🇭 Philippine Data Privacy Act of 2012 (RA 10173)

Authentication & Access Control

Role-Based Access Control (Admin, Veterinarian, Staff, Pet Owner)

Password hashing (bcrypt / Argon2)

Account lockout after 5 failed attempts

Secure session tokens

Auto logout after inactivity

Data Protection
In Transit

Enforced HTTPS

At Rest

Encrypted PII fields

Segregated cloud/local credentials

Disabled remote root access

Threat Mitigation

SQL Injection → Prepared statements

XSS → Input sanitization & output escaping

CSRF → Token validation

File upload restrictions & scanning

📊 Key Success Metrics

30% reduction in appointment processing time

Near-zero inventory stockouts

Faster record retrieval during consultations

Improved client satisfaction ratings

💾 Backup & Recovery

Daily incremental backups

Weekly full backups

Encrypted backup storage

Quarterly recovery testing

Documented restoration procedures

🚀 Future Roadmap

SMS notification integration

Payment gateway integration

Mobile application version

Advanced forecasting models

Analytics dashboard

🛠 Development Setup (High-Level)
Cloud API
git clone <repo>
composer install
npm install
php artisan migrate
php artisan serve
Local System

Install XAMPP

Configure local database

Import schema

Start Apache & MySQL

AI Module
pip install -r requirements.txt
python train_model.py
📌 Project Status

Version 1.0 – Initial Hybrid Deployment
Actively under development.

📄 License

Proprietary – AutoVet Development Team
