# /// script
# requires-python = ">=3.11"
# dependencies = ["jsonschema[format]==4.25.1"]
# ///
"""Structural conformance cases for the draft format; no renderer or editor implementation."""
from copy import deepcopy
import json
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = json.loads((ROOT / 'docs/ids-document.schema.json').read_text(encoding='utf-8'))
EXAMPLE = json.loads((ROOT / 'docs/ids-document.example.json').read_text(encoding='utf-8'))


def main():
    Draft202012Validator.check_schema(SCHEMA)
    validator = Draft202012Validator(SCHEMA, format_checker=FormatChecker())
    base = {'format': 'ids-input/document', 'version': 1,
            'render': {'mode': 'unbound'}, 'root': {'id': 'root', 'kind': 'slot'}}
    cases = []

    def case(name, doc, valid=True):
        cases.append((name, deepcopy(doc), valid))

    def with_root(root):
        return {**deepcopy(base), 'root': root}

    def with_transform(operation):
        doc = deepcopy(base)
        doc['root']['transform'] = [operation]
        return doc

    case('complete example', EXAMPLE)
    case('empty document is a slot', base)
    case('affine identity', with_transform({'type': 'affine', 'matrix': [1, 0, 0, 1, 0, 0]}))
    identity = deepcopy(base)
    identity['root']['transform'] = []
    case('empty operation array', identity)
    case('supplementary component with variation selector', with_root({'id': 'a', 'kind': 'component', 'char': '𠮷\U000E0100'}))
    case('group retains child identity', with_root({'id': 'wrapper', 'kind': 'group', 'child': base['root']}))
    case('unknown operation retained', with_transform({'type': 'example.org/warp', 'parameters': {'strength': 3}}))
    metadata = deepcopy(base)
    metadata['extensions'] = {'example.org/editor': {'custom': ['kept', 1]}}
    case('opaque metadata retained', metadata)
    for op in ['⿾', '⿿', '〾']:
        case(f'unary {op}', with_root({'id': 'a', 'kind': 'operator', 'op': op, 'children': [base['root']]}))
    for op in '⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽㇯':
        case(f'binary {op}', with_root({'id': 'a', 'kind': 'operator', 'op': op, 'children': [{'id': 'b', 'kind': 'slot'}, {'id': 'c', 'kind': 'slot'}]}))
    for op in ['⿲', '⿳']:
        case(f'ternary {op}', with_root({'id': 'a', 'kind': 'operator', 'op': op, 'children': [{'id': x, 'kind': 'slot'} for x in ['b', 'c', 'd']]}))
    case('projective shape', with_transform({'type': 'projective', 'matrix': [1, 0, 0, 0, 1, 0, 0.0004, 0, 1]}))
    case('Mobius shape', with_transform({'type': 'mobius', 'a': [1, 0], 'b': [0, 0], 'c': [0.001, 0], 'd': [1, 0]}))

    # Synthetic identifiers test structure only; they claim no available renderer or asset.
    pinned = deepcopy(EXAMPLE)
    pinned['render'] = {'mode': 'pinned', 'engine': 'example.org/test-renderer', 'revision': 'fixture-1', 'options': {},
                        'assets': [{'role': 'fixture', 'sha256': '0' * 64}]}
    pinned['geometryEdits'] = [{'id': 'edit-1', 'node': 'mouth', 'geometry': '1' * 64,
                               'target': {'kind': 'contour', 'piece': 0, 'contour': 1}, 'transform': []}]
    case('pinned contour edit', pinned)
    stroke = deepcopy(pinned)
    stroke['geometryEdits'][0]['target'] = {'kind': 'stroke', 'id': 'source-stroke-1'}
    case('source stroke identity', stroke)
    stale = deepcopy(pinned)
    stale['geometryEdits'][0]['node'] = 'removed-layer'
    case('unresolved reference remains serializable', stale)

    case('old positional document rejected', {'format': 'ids-input/document', 'version': 1, 'sequence': '⿰木口', 'layers': []}, False)
    case('duplicate authority rejected', {**base, 'sequence': '木'}, False)
    case('missing root rejected', {k: v for k, v in base.items() if k != 'root'}, False)
    case('null root rejected', with_root(None), False)
    case('missing node ID', with_root({'kind': 'slot'}), False)
    case('newline in node ID', with_root({'id': 'a\n', 'kind': 'slot'}), False)
    case('invalid node ID', with_root({'id': 'a/b', 'kind': 'slot'}), False)
    case('unsupported node kind', with_root({'id': 'a', 'kind': 'other'}), False)
    case('component with children rejected', with_root({'id': 'a', 'kind': 'component', 'char': '木', 'children': []}), False)
    case('empty component rejected', with_root({'id': 'a', 'kind': 'component', 'char': ''}), False)
    case('group needs a child', with_root({'id': 'a', 'kind': 'group'}), False)
    case('unknown operator rejected', with_root({'id': 'a', 'kind': 'operator', 'op': '+', 'children': [base['root']]}), False)
    case('wrong binary arity', with_root({'id': 'a', 'kind': 'operator', 'op': '⿰', 'children': [base['root']]}), False)
    case('wrong unary arity', with_root({'id': 'a', 'kind': 'operator', 'op': '⿾', 'children': [base['root'], base['root']]}), False)
    for operation in [
        {'type': 'affine', 'matrix': [1, 0, 0]},
        {'type': 'affine', 'matrix': [1, 0, 0, 1, '0', 0]},
        {'type': 'projective', 'matrix': [1, 0, 0, 1, 0, 0]},
        {'type': 'mobius', 'a': [1, 0], 'b': [0, 0], 'c': [0, 0]},
        {'matrix': [1, 0, 0, 1, 0, 0]},
    ]:
        case(f'malformed known operation {operation.get("type", "missing type")}', with_transform(operation), False)
    too_many = deepcopy(base)
    too_many['root']['transform'] = [{'type': 'affine', 'matrix': [1, 0, 0, 1, 0, 0]}] * 65
    case('operation count bounded', too_many, False)
    unbound_edit = deepcopy(pinned)
    unbound_edit['render'] = {'mode': 'unbound'}
    case('geometry edit needs pinned recipe', unbound_edit, False)
    bad_digest = deepcopy(pinned)
    bad_digest['geometryEdits'][0]['geometry'] = 'not-a-digest'
    case('fingerprint syntax checked', bad_digest, False)
    newline_digest = deepcopy(pinned)
    newline_digest['geometryEdits'][0]['geometry'] += '\n'
    case('newline after digest rejected', newline_digest, False)
    bad_index = deepcopy(pinned)
    bad_index['geometryEdits'][0]['target']['contour'] = -1
    case('negative contour index rejected', bad_index, False)
    incomplete_recipe = deepcopy(pinned)
    del incomplete_recipe['render']['revision']
    case('pinned recipe needs revision', incomplete_recipe, False)
    case('date-time checked', {**base, 'created': 'yesterday'}, False)

    # These belong to semantic validation. Schema acceptance must not be advertised as validity.
    duplicate_ids = with_root({'id': 'root', 'kind': 'group', 'child': base['root']})
    case('duplicate IDs require semantic check', duplicate_ids)
    case('component grammar requires core check', with_root({'id': 'a', 'kind': 'component', 'char': '木口'}))
    case('singularity requires semantic check', with_transform({'type': 'affine', 'matrix': [0, 0, 0, 0, 0, 0]}))

    for name, document, expected in cases:
        errors = list(validator.iter_errors(document))
        if (not errors) != expected:
            detail = errors[0].message if errors else 'unexpected acceptance'
            raise AssertionError(f'{name}: {detail}')
    print(f'{len(cases)} structural schema cases passed; semantic and renderer checks are not implemented here')


if __name__ == '__main__':
    main()
