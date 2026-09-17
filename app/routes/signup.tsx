import { Form, Link, data, redirect } from "react-router";
import type { Route } from "./+types/signup";
import { prisma, now } from "~/lib/db.server";
import { hashPassword } from "~/lib/password.server";
import { createUserSession, getUser, safeNext } from "~/lib/session.server";
import { str } from "~/lib/validate";
import { Alert, Button, Card, Input, Label } from "~/components/ui";
import { Art } from "~/components/art";
import { Shell } from "~/components/shell";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  if (user) throw redirect(next);
  return { next };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = str(form, "email").toLowerCase();
  const name = str(form, "name");
  const password = form.get("password");
  const next = safeNext(str(form, "next"));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return data({ error: "Enter a valid email." }, { status: 400 });
  if (!name) return data({ error: "Enter your name." }, { status: 400 });
  if (typeof password !== "string" || password.length < 8) return data({ error: "Password must be at least 8 characters." }, { status: 400 });
  const existing = await prisma().user.findUnique({ where: { email } });
  if (existing) return data({ error: "An account with that email already exists. Log in instead." }, { status: 400 });
  const user = await prisma().user.create({ data: { email, name, passwordHash: await hashPassword(password), createdAt: now() } });
  return createUserSession(user.id, next);
}

export default function Signup({ loaderData, actionData }: Route.ComponentProps) {
  const login = `/login?next=${encodeURIComponent(loaderData.next)}`;
  return (
    <Shell footer={false} right={<Link className="underline" to={login}>Log in</Link>}>
      <Art name="stalk" preserveAspectRatio="xMinYMax meet" className="pointer-events-none fixed bottom-0 left-10 hidden h-[62vh] w-auto text-stone-900 opacity-20 lg:block dark:text-stone-100 dark:opacity-25" />
      <main className="mx-auto max-w-sm px-6 py-16">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Create your account</h1>
        <Card>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="next" value={loaderData.next} />
            {actionData?.error && <Alert>{actionData.error}</Alert>}
            <div><Label htmlFor="name">Name</Label><Input id="name" name="name" required autoComplete="name" /></div>
            <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required autoComplete="email" /></div>
            <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" /></div>
            <Button type="submit" className="w-full">Sign up</Button>
          </Form>
        </Card>
        <p className="mt-4 text-sm text-stone-500">
          Already have an account? <Link className="underline" to={login}>Log in</Link>
        </p>
      </main>
    </Shell>
  );
}
