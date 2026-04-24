import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, User, Bot, MapPin, Phone, Clock, Stethoscope } from 'lucide-react';
import clsx from 'clsx';

// NLP Helper: Levenshtein Distance for handling typos
const getEditDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
};

interface Message {
  id: number;
  type: 'user' | 'bot';
  text: string;
}

interface Intent {
  name: string;
  keywords: string[];
  phrases: string[];
  answers: string[];
  question?: string;
  icon?: React.ReactNode;
}

const INTENTS: Intent[] = [
  {
    name: "branches",
    question: "Where are you located?",
    keywords: ["branch", "location", "where", "address", "branches", "place", "clinic", "qc", "quezon city", "map"],
    phrases: ["where are you located", "do you have branches", "is there a clinic in qc", "where is your clinic"],
    answers: ["Our clinic is located at **Blk 10 lot2D Dahlia Ave, West Fairview, Q.C**. We are fully equipped to provide the best care for your pets at this location!", "You can visit us at our branch in **Blk 10 lot2D Dahlia Ave, West Fairview, Q.C**. We'd love to see you and your pet there!"],
    icon: <MapPin className="w-3 h-3" />
  },
  {
    name: "contact",
    question: "How to contact you?",
    keywords: ["contact", "phone", "number", "email", "call", "reach", "mobile", "cellphone", "telephone"],
    phrases: ["how can I contact you", "what is your phone number", "give me your email", "how to reach you", "call you"],
    answers: ["You can reach us through our mobile numbers:\n**0933-461-7957**\n**0966-421-9903**\n\nOr email us at:\n**badetvelasquez@gmail.com**"],
    icon: <Phone className="w-3 h-3" />
  },
  {
    name: "services",
    question: "What are your services?",
    keywords: ["service", "offer", "do", "groom", "vaccine", "surgery", "checkup", "dental", "laboratory", "consultation", "treatment"],
    phrases: ["what services do you offer", "do you do grooming", "can you perform surgery", "what are your services", "pet care"],
    answers: ["We offer a wide range of professional services:\n• Vaccinations\n• Surgeries\n• Pet Grooming\n• Laboratory Tests\n• Dental Care\n• General Consultations"],
    icon: <Stethoscope className="w-3 h-3" />
  },
  {
    name: "hours",
    question: "What are your hours?",
    keywords: ["hour", "time", "open", "close", "schedule", "sunday", "saturday", "operating", "when"],
    phrases: ["what time do you open", "are you open on sundays", "what are your clinic hours", "when do you close"],
    answers: ["We are open to serve you:\n**Monday - Saturday:** 8:00 AM - 6:00 PM\n**Sunday:** 9:00 AM - 4:00 PM"],
    icon: <Clock className="w-3 h-3" />
  },
  {
    name: "appointment",
    question: "How to book an appointment?",
    keywords: ["book", "appointment", "schedule", "reservation", "visit", "slot", "reserve"],
    phrases: ["i want to book an appointment", "how to schedule a visit", "can i make a reservation", "need to see a vet"],
    answers: ["To book an appointment, please **Log In** to your account and go to the **Book Appointment** section. If you don't have an account yet, you can **Register** in just a few clicks!", "You can easily schedule a visit through our portal once you are logged in. This helps us keep track of your pet's medical history!"]
  },
  {
    name: "pricing",
    question: "How much are your fees?",
    keywords: ["price", "cost", "fee", "rate", "payment", "expensive", "cheap", "how much"],
    phrases: ["how much for a checkup", "what are your rates", "is consultation free", "pricing for grooming"],
    answers: ["Our consultation fees start at a very affordable rate. Specific costs for surgeries or grooming depend on the size and condition of your pet. You can ask for a quote when you book your appointment!", "We strive to provide quality care at competitive prices. For a detailed breakdown of services like vaccinations or laboratory tests, please contact us directly."]
  },
  {
    name: "emergency",
    question: "What if it's an emergency?",
    keywords: ["emergency", "urgent", "dying", "accident", "bleeding", "poison", "critical", "help now"],
    phrases: ["this is an emergency", "my pet is in critical condition", "help my dog is bleeding", "emergency vet needed"],
    answers: ["**FOR EMERGENCIES:** Please call us immediately at **0933-461-7957** or **0966-421-9903**. Do not wait for a portal booking. Bring your pet directly to our clinic at **Blk 10 lot2D Dahlia Ave, West Fairview**."]
  },
  {
    name: "first_time",
    question: "What to bring for first visit?",
    keywords: ["first", "bring", "requirement", "need", "document", "record", "new"],
    phrases: ["it is my first time", "what do i need to bring", "requirements for new patients"],
    answers: ["For your first visit, please bring any **previous medical or vaccination records** your pet may have. Also, ensure your pet is in a secure carrier or on a sturdy leash for their safety and the safety of others."]
  },
  {
    name: "greeting",
    keywords: ["hi", "hello", "hey", "morning", "afternoon", "evening", "sup"],
    phrases: ["hi there", "hello assistant", "is anyone there", "good morning", "good afternoon"],
    answers: ["Hello! I'm your AutoVet assistant. How can I help you today?", "Hi! I'm here to answer any questions about our clinic. What's on your mind?", "Hey! Ready to help you and your pet. What do you need to know?"]
  },
  {
    name: "thanks",
    keywords: ["thanks", "thank", "ty", "salamat", "thx", "appreciate"],
    phrases: ["thank you so much", "thanks for the help", "you are helpful"],
    answers: ["You're very welcome!", "Happy to help you and your pet!", "No problem at all. Is there anything else?", "Anytime! Let me know if you need more info."]
  },
  {
    name: "identity",
    keywords: ["who", "name", "what", "bot", "ai", "assistant"],
    phrases: ["who are you", "what is your name", "are you a robot", "what can you do"],
    answers: ["I am the AutoVet Virtual Assistant. I'm here to help you with our **QC branch**, **contact info**, **services**, and **clinic hours**!"]
  }
];

const STOP_WORDS = ["the", "this", "that", "is", "are", "was", "were", "and", "but", "for", "with", "have", "been", "does", "what", "where", "when", "how", "your", "mine", "clinic"];

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, type: 'bot', text: "Hello! I'm your NLP-enhanced AutoVet assistant. How can I help you today?" }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const processNLP = (input: string): string => {
    const text = input.toLowerCase().trim();
    if (!text) return "Please type something so I can help you!";

    // Direct match for common short inputs
    if (text === "hi" || text === "hello" || text === "hey") {
      return INTENTS.find(i => i.name === "greeting")?.answers[0] || "Hello!";
    }

    let bestIntent = null;
    let highestScore = 0;

    const inputWords = text.split(/\s+/).filter(w => !STOP_WORDS.includes(w) && w.length > 1);

    for (const intent of INTENTS) {
      let score = 0;
      
      // 1. Phrase Matching (High Weight)
      for (const phrase of intent.phrases) {
        if (text.includes(phrase.toLowerCase())) score += 15;
      }

      // 2. Keyword Scoring
      for (const word of inputWords) {
        // Exact Keyword Match
        if (intent.keywords.some(k => k.toLowerCase() === word)) {
          score += 5;
        } else {
          // Partial/Fuzzy Match
          for (const keyword of intent.keywords) {
            const k = keyword.toLowerCase();
            if (k.length > 3 && (word.includes(k) || k.includes(word))) {
              score += 2;
            } else if (k.length > 3 && getEditDistance(word, k) === 1) {
              score += 3;
            }
          }
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestIntent = intent;
      }
    }

    // Lower threshold to 2 to be more permissive
    if (bestIntent && highestScore >= 2) {
      const randomIdx = Math.floor(Math.random() * bestIntent.answers.length);
      return bestIntent.answers[randomIdx];
    }

    return "I'm sorry, I'm still learning! I can help you with our **branches**, **contact info**, **services**, **hours**, **appointments**, or **pricing**. Could you please rephrase your question?";
  };

  const handleSendMessage = (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: Message = { id: Date.now(), type: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    setTimeout(() => {
      const responseText = processNLP(text);
      const botMsg: Message = { 
        id: Date.now() + 1, 
        type: 'bot', 
        text: responseText
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 800);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans">
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-16 h-16 bg-brand-500 rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 transition-transform duration-300 group"
          aria-label="Open Chatbot"
        >
          <MessageCircle className="w-8 h-8 group-hover:rotate-12 transition-transform" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="w-[350px] sm:w-[400px] h-[600px] bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-bottom-10 fade-in duration-300">
          {/* Header */}
          <div className="bg-brand-500 p-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold tracking-tight">Pet Wellness Assistant</h3>
                <p className="text-[10px] text-brand-100 uppercase font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  NLP Powered
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100"
          >
            {messages.map((msg) => (
              <div 
                key={msg.id}
                className={clsx(
                  "flex items-start gap-2 max-w-[85%] animate-in fade-in duration-300",
                  msg.type === 'user' ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <div className={clsx(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  msg.type === 'bot' ? "bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                )}>
                  {msg.type === 'bot' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <div className={clsx(
                  "p-3 rounded-2xl text-sm leading-relaxed",
                  msg.type === 'bot' 
                    ? "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 shadow-sm rounded-tl-none border border-zinc-100 dark:border-zinc-700" 
                    : "bg-brand-500 text-white rounded-tr-none shadow-md shadow-brand-500/20"
                )}>
                  {msg.text.split('\n').map((line, i) => (
                    <div key={i} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                  ))}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex items-start gap-2 max-w-[85%]">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white dark:bg-zinc-800 p-3 rounded-2xl rounded-tl-none border border-zinc-100 dark:border-zinc-700">
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-zinc-300 dark:bg-zinc-600 rounded-full animate-bounce" />
                    <div className="w-1 h-1 bg-zinc-300 dark:bg-zinc-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1 h-1 bg-zinc-300 dark:bg-zinc-600 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Suggestions Only Area */}
          <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex flex-wrap gap-2">
              {INTENTS.filter(i => i.question).map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(item.question!)}
                  disabled={isTyping}
                  className="text-[10px] font-bold uppercase tracking-tight px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-all dark:text-zinc-400 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {item.icon}
                  {item.question?.replace("?", "")}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
