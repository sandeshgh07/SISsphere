import StudentCheckoutTab from "@/components/StudentCheckoutTab";
import { useAuth } from "@/context/AuthContext";

export default function CheckoutPage() {
    return (
        <div className="space-y-6 col-span-full min-h-[calc(100vh-10rem)] p-6" data-testid="checkout-page">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Student Checkout
                </h1>
            </div>
            <StudentCheckoutTab />
        </div>
    );
}
