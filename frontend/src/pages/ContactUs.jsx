import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, Send, ArrowLeft, Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';
import axios from 'axios';

const CLASSA_PRIMARY = '#003333';
const CLASSA_ACCENT = '#5C2438';

function ContactUs() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        school_name: '',
        message: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.email || !formData.subject || !formData.message) {
            toast.error('Please fill in all required fields');
            return;
        }

        setSubmitting(true);
        try {
            await axios.post('/api/public/contact', formData);
            setSubmitted(true);
            toast.success('Message sent successfully!');
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to send message. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `linear-gradient(135deg, ${CLASSA_PRIMARY} 0%, #001a1a 100%)` }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                >
                    <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10 text-green-400" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4">Thank You!</h2>
                    <p className="text-gray-300 mb-8 max-w-md">
                        Your message has been received. Our team will get back to you within 24 hours.
                    </p>
                    <Button
                        onClick={() => navigate('/')}
                        className="bg-white text-gray-900 hover:bg-gray-100"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Home
                    </Button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ background: `linear-gradient(135deg, ${CLASSA_PRIMARY} 0%, #001a1a 100%)` }}>
            {/* Header */}
            <header className="p-6">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>Back to Home</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <Building2 className="w-8 h-8 text-white" />
                        <span className="text-xl font-bold text-white">Classa Enterprise</span>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-12">
                <div className="grid lg:grid-cols-2 gap-12 items-start">
                    {/* Contact Info */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="space-y-8"
                    >
                        <div>
                            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                                Get in Touch
                            </h1>
                            <p className="text-xl text-gray-300">
                                Ready to transform your school? We'd love to hear from you.
                            </p>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/10 backdrop-blur-sm">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: CLASSA_ACCENT }}>
                                    <Mail className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">Email Us</p>
                                    <a href="mailto:sandeshgh07@gmail.com" className="text-lg font-semibold text-white hover:underline">
                                        sandeshgh07@gmail.com
                                    </a>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/10 backdrop-blur-sm">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: CLASSA_ACCENT }}>
                                    <Phone className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">Call Us</p>
                                    <a href="tel:+16477452035" className="text-lg font-semibold text-white hover:underline">
                                        +1 (647) 745-2035
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                            <h3 className="text-lg font-semibold text-white mb-3">Why Choose Classa?</h3>
                            <ul className="space-y-2 text-gray-300">
                                <li className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CLASSA_ACCENT }} />
                                    End-to-end school management
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CLASSA_ACCENT }} />
                                    AI-powered insights
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CLASSA_ACCENT }} />
                                    24/7 priority support
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CLASSA_ACCENT }} />
                                    Custom training included
                                </li>
                            </ul>
                        </div>
                    </motion.div>

                    {/* Contact Form */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <Card className="bg-white/95 backdrop-blur border-0 shadow-2xl">
                            <CardHeader>
                                <CardTitle className="text-2xl" style={{ color: CLASSA_PRIMARY }}>
                                    Send Us a Message
                                </CardTitle>
                                <CardDescription>
                                    Fill out the form below and we'll get back to you shortly.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">Name *</Label>
                                            <Input
                                                id="name"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                placeholder="Your full name"
                                                required
                                                disabled={submitting}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email *</Label>
                                            <Input
                                                id="email"
                                                name="email"
                                                type="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                placeholder="your@email.com"
                                                required
                                                disabled={submitting}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="subject">Subject *</Label>
                                        <Input
                                            id="subject"
                                            name="subject"
                                            value={formData.subject}
                                            onChange={handleChange}
                                            placeholder="How can we help?"
                                            required
                                            disabled={submitting}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="school_name">School Name (Optional)</Label>
                                        <Input
                                            id="school_name"
                                            name="school_name"
                                            value={formData.school_name}
                                            onChange={handleChange}
                                            placeholder="Your institution's name"
                                            disabled={submitting}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="message">Message *</Label>
                                        <textarea
                                            id="message"
                                            name="message"
                                            value={formData.message}
                                            onChange={handleChange}
                                            placeholder="Tell us about your needs..."
                                            required
                                            disabled={submitting}
                                            rows={5}
                                            className="w-full px-3 py-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-offset-2"
                                            style={{ '--tw-ring-color': CLASSA_PRIMARY }}
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={submitting}
                                        className="w-full text-white"
                                        style={{ backgroundColor: CLASSA_ACCENT }}
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4 mr-2" />
                                                Send Message
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-8 text-center text-gray-400 text-sm">
                © 2026 Classa Enterprise. All rights reserved.
            </footer>
        </div>
    );
}

export default ContactUs;
