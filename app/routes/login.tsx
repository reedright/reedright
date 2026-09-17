import { Form, Link, data, redirect } from "react-router";
import type { Route } from "./+types/login";
import { prisma } from "~/lib/db.server";
import { verifyPassword } from "~/lib/password.server";
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
  const password = form.get("password");
  const next = safeNext(str(form, "next"));
  const user = await prisma().user.findUnique({ where: { email } });
  const ok = user && typeof password === "string" && (await verifyPassword(password, user.passwordHash));
  if (!ok) return data({ error: "Email or password is incorrect." }, { status: 400 });
  return createUserSession(user.id, next);
}

export default function Login({ loaderData, actionData }: Route.ComponentProps) {
  const signup = `/signup?next=${encodeURIComponent(loaderData.next)}`;
  return (
    <Shell footer={false} right={<Link className="underline" to={signup}>Sign up</Link>}>
      <Art name="stalk" preserveAspectRatio="xMinYMax meet" className="pointer-events-none fixed bottom-0 left-10 hidden h-[62vh] w-auto text-stone-900 opacity-20 lg:block dark:text-stone-100 dark:opacity-25" />
      <main className="mx-auto max-w-sm px-6 py-16">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Log in</h1>
        <Card>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="next" value={loaderData.next} />
            {actionData?.error && <Alert>{actionData.error}</Alert>}
            <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required autoComplete="email" /></div>
            <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" required autoComplete="current-password" /></div>
            <Button type="submit" className="w-full">Log in</Button>
          </Form>
        </Card>
        <p className="mt-4 text-sm text-stone-500">
          New here? <Link className="underline" to={signup}>Create an account</Link>
        </p>
      </main>
    </Shell>
  );
}
