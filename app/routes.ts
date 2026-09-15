import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("healthz", "routes/healthz.ts"),
  route("signup", "routes/signup.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.ts"),
  route("invite/:token", "routes/invite.$token.tsx"),
  route("orgs/new", "routes/orgs.new.tsx"),
  route("orgs/:slug", "routes/orgs.$slug.tsx", [
    index("routes/orgs.$slug._index.tsx"),
    route("members", "routes/orgs.$slug.members.tsx"),
    route("tokens", "routes/orgs.$slug.tokens.tsx"),
  ]),
] satisfies RouteConfig;
