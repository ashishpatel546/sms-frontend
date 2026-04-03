import { redirect } from 'next/navigation';

export async function POST(request: Request) {
    // Parse the form data URL Encoded POST payload coming from Razorpay's callback_url
    const formData = await request.formData();

    // Extract the Razorpay fields
    const orderId = formData.get('razorpay_order_id') as string;
    const paymentId = formData.get('razorpay_payment_id') as string;
    const signature = formData.get('razorpay_signature') as string;
    // Intelligently resolve the public base URL using standard proxy forward headers first
    const protocol = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https') ? 'https' : 'http');
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host;

    // Fallback order: Explicit Env -> Proxied Host Header -> Raw Request URL
    let baseUrl = process.env.FRONTEND_URL || `${protocol}://${host}`;

    // Build the absolute redirect URL with GET parameters
    const redirectUrl = new URL('/parent-dashboard/payment-success', baseUrl);
    if (orderId) redirectUrl.searchParams.set('order_id', orderId);
    if (paymentId) redirectUrl.searchParams.set('payment_id', paymentId);
    if (signature) redirectUrl.searchParams.set('signature', signature);

    // Redirect the user via a 303 See Other (turns POST into GET on client)
    return Response.redirect(redirectUrl.toString(), 303);
}
