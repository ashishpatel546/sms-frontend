"use client";

import dynamic from "next/dynamic";

// ssr: false must be inside a Client Component. This thin wrapper exists
// solely to let page.tsx (a Server Component) render GreetingCard without
// running it on the server (GreetingCard reads localStorage via getUser()).
const GreetingCard = dynamic(() => import("./GreetingCard"), { ssr: false });

export default GreetingCard;
