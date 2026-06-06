import axios from "axios";

const BASE = (import.meta.env.VITE_ADMIN_API_URL as string) || "http://localhost:5000";

// Authenticated student client — payments require a verified login (the server
// rejects without a token). Sends both the id header and the auth token.
const api = axios.create({ baseURL: `${BASE}/api/public/payments`, timeout: 20000 });
api.interceptors.request.use((config) => {
  const id = localStorage.getItem("userId");
  if (id) config.headers.set("x-user-id", String(id));
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

type OrderResp = {
  order_id?: string;
  amount?: number;
  currency?: string;
  key_id?: string;
  alreadyPaid?: boolean;
  message?: string;
  course?: { id: number; title: string };
};

export const createOrder = (courseId: number) =>
  api.post("/order", { course_id: courseId }).then((r) => r.data as OrderResp);

export const verifyPayment = (payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) => api.post("/verify", payload).then((r) => r.data as { success: boolean; message: string });

// Lazy-load the Razorpay checkout script once.
const loadRazorpay = () =>
  new Promise<boolean>((resolve) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

// One-call course purchase: create order → open Razorpay → verify → onSuccess.
// Returns false if not configured / cancelled / failed (caller shows a message).
export async function buyCourse(
  courseId: number,
  buyer: { name?: string; email?: string; phone?: string },
  onSuccess: () => void,
  onError?: (msg: string) => void,
): Promise<void> {
  try {
    const order = await createOrder(courseId);
    if (order.alreadyPaid) { onSuccess(); return; }
    if (!order.order_id || !order.key_id) {
      onError?.(order.message || "Payment could not be started.");
      return;
    }
    const ok = await loadRazorpay();
    if (!ok) { onError?.("Could not load the payment window."); return; }

    const Razorpay = (window as unknown as { Razorpay: new (o: unknown) => { open: () => void } }).Razorpay;
    const rzp = new Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency || "INR",
      name: "VR Robotics Academy",
      description: order.course?.title || "Course purchase",
      order_id: order.order_id,
      prefill: { name: buyer.name, email: buyer.email, contact: buyer.phone },
      theme: { color: "#FF6A00" },
      handler: async (resp: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        try {
          const v = await verifyPayment(resp);
          if (v.success) onSuccess();
          else onError?.(v.message || "Payment verification failed.");
        } catch {
          onError?.("Payment succeeded but verification failed — contact support.");
        }
      },
    });
    rzp.open();
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Payment failed.";
    onError?.(msg);
  }
}
