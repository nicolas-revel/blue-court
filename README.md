# Blue Court

Blue Court is a volleyball tournament manager where everything is configurable: team size, solo or team registration, sequences of phases (pools, level pools, single elimination, double elimination, full placement bracket), match rules per phase, court scheduling, score entry and a live mobile view for players.

Work in progress. The specs are in [docs/specs](docs/specs/README.md) and progress is tracked in the [build journal](docs/journal).

## Method

The project is built with Claude Code, in the open:

- `CLAUDE.md` describes conventions and the domain for the agent;
- skills in `.claude/skills/` drive the work, from grilling an idea to reviewing a PR;
- conventions are enforced by lint rules rather than prose;
- every feature starts from an issue linked to the specs and goes through a reviewed PR;
- CI (lint, build, typecheck, tests) blocks any regression;
- the build journal records what the AI produced and what was taken over by hand.

Details in [docs/method.md](docs/method.md).

## Getting started

```sh
pnpm install
pnpm check
cp .env.example .env        # choose a database password
docker compose up --build   # web app on :3000, API on :4000
```

See [docs/deployment.md](docs/deployment.md) for running the apps and deploying them.

## License

[Functional Source License 1.1, ALv2 Future License](LICENSE.md): the code can be read, reused and modified, except to offer a competing service. Each version becomes Apache 2.0 two years after its release.
