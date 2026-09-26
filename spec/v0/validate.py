"""Valide les exemples de la spec v0 contre les schémas.

Usage : pip install jsonschema referencing && python validate.py
Les fichiers de examples/valid doivent passer, ceux de examples/invalid doivent échouer.
"""
import json
import pathlib
import sys

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

root = pathlib.Path(__file__).parent
schemas = {n: json.loads((root / n).read_text(encoding="utf-8")) for n in ["manifest.schema.json", "entry.schema.json"]}
for s in schemas.values():
    Draft202012Validator.check_schema(s)

registry = Registry().with_resources([(s["$id"], Resource.from_contents(s)) for s in schemas.values()])
validators = {
    k: Draft202012Validator(schemas[f"{k}.schema.json"], registry=registry, format_checker=Draft202012Validator.FORMAT_CHECKER)
    for k in ["manifest", "entry"]
}

ok = True
for expected in ["valid", "invalid"]:
    for f in sorted((root / "examples" / expected).glob("*.json")):
        # Le préfixe du nom de fichier (manifest.* / entry.*) désigne le schéma à appliquer
        errors = list(validators[f.name.split(".")[0]].iter_errors(json.loads(f.read_text(encoding="utf-8"))))
        good = (not errors) == (expected == "valid")
        ok &= good
        print("OK  " if good else "FAIL", expected, f.name, "|", errors[0].message[:90] if errors else "")

sys.exit(0 if ok else 1)
