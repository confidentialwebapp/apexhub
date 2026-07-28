/**
 * Materializes a provider definition into `checks-source/providers/<id>/`,
 * using the same directory layout as the vendored upstream providers so the
 * in-app source viewer resolves `<provider>/services/<service>/<id>/<id>.py`.
 */
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as T from "./templates.mjs";
import { toMetadata } from "./transform.mjs";

const write = (p, body) => {
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, body);
};

/**
 * @param def   provider definition
 * @param root  absolute path to checks-source/providers
 * @param opts.existingProvider true when adding checks to a vendored upstream
 *              provider — only the check directories are written, the provider
 *              scaffolding is left alone.
 */
export function emitProvider(def, root) {
  const dir = join(root, def.id);
  const files = [];

  if (!def.extendsUpstream) {
    // Regenerate the scaffolding from scratch so stale services never linger.
    if (existsSync(join(dir, "apexhub.provider.json"))) rmSync(dir, { recursive: true });

    write(join(dir, "__init__.py"), "");
    write(join(dir, "models.py"), T.models(def));
    write(join(dir, "exceptions", "__init__.py"), "");
    write(join(dir, "exceptions", "exceptions.py"), T.exceptions(def));
    write(join(dir, "lib", "__init__.py"), "");
    write(join(dir, "lib", "service", "__init__.py"), "");
    // Most providers share the HTTP base; SQL- or driver-backed ones supply
    // their own (see snowflake.mjs).
    write(join(dir, "lib", "service", "service.py"), def.serviceBaseSource ?? T.serviceBase(def));
    write(join(dir, "services", "__init__.py"), "");

    // Marker consumed by the loader; also documents provenance in the repo.
    write(
      join(dir, "apexhub.provider.json"),
      JSON.stringify(
        {
          id: def.id,
          name: def.name,
          origin: "apexhub-first-party",
          license: "Apache-2.0",
          generated_by: "scripts/build-custom.mjs",
        },
        null,
        2
      ) + "\n"
    );
    files.push(`${def.id}/ (scaffolding)`);

    for (const [key, svc] of Object.entries(def.services)) {
      const sdir = join(dir, "services", key);
      write(join(sdir, "__init__.py"), "");
      write(join(sdir, `${key}_service.py`), svc.source);
      write(join(sdir, `${key}_client.py`), T.serviceClient(def, key, svc));
      files.push(`${def.id}/services/${key}`);
    }
  }

  // A provider extending an upstream one keeps its vendored scaffolding, but
  // may still introduce services that upstream does not have.
  for (const [key, svc] of Object.entries(def.newServices ?? {})) {
    const sdir = join(dir, "services", key);
    write(join(sdir, "__init__.py"), "");
    write(join(sdir, `${key}_service.py`), svc.source);
    write(join(sdir, `${key}_client.py`), T.serviceClient(def, key, svc));
    files.push(`${def.id}/services/${key}`);
  }

  for (const check of def.checks) {
    const cdir = join(dir, "services", check.service, check.id);
    write(join(cdir, "__init__.py"), "");
    write(join(cdir, `${check.id}.py`), T.checkModule(def, check));
    write(
      join(cdir, `${check.id}.metadata.json`),
      JSON.stringify(toMetadata(def, check), null, 2) + "\n"
    );
    files.push(`${def.id}/services/${check.service}/${check.id}`);
  }

  return files;
}
