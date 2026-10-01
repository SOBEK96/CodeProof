"""create_grant / submit_deliverable / cancel_grant input validation and accounting."""

import json
import pytest
from conftest import *


@pytest.fixture
def env(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c = direct_deploy(CONTRACT)
    return c, direct_vm, direct_alice, direct_bob, direct_charlie


def dev_hex(env):
    c, vm, a, b, s = env
    return hexof(c, vm, b)


# ---- create_grant ----------------------------------------------------------
def test_create_grant_returns_sequential_ids(env):
    c, vm, a, b, s = env
    assert create(c, vm, a, dev_hex(env)) == 1
    assert create(c, vm, a, dev_hex(env), title="Second") == 2


def test_create_grant_stores_fields(env):
    c, vm, a, b, s = env
    gid = create(c, vm, a, dev_hex(env), title="Flash Loan Vault", threshold=90)
    g = c.get_grant(gid)
    assert g["title"] == "Flash Loan Vault"
    assert g["threshold_score"] == 90
    assert g["status"] == "OPEN"
    assert g["escrow_amount"] == str(GRANT)
    assert g["developer"].lower() == dev_hex(env).lower()
    assert g["developer_bond"] == "0"
    assert g["quality_score"] == 0
    assert g["evaluated"] is False


def test_create_grant_default_threshold_is_85(env):
    c, vm, a, b, s = env
    gid = create(c, vm, a, dev_hex(env), threshold=0)
    assert c.get_grant(gid)["threshold_score"] == 85


@pytest.mark.parametrize("thr", [1, 49, 50, 69, 101, 1000])
def test_create_grant_rejects_bad_threshold(env, thr):
    c, vm, a, b, s = env
    with vm.expect_revert("ERR_INVALID_PARAMS"):
        create(c, vm, a, dev_hex(env), threshold=thr)


@pytest.mark.parametrize("thr", [70, 71, 85, 99, 100])
def test_create_grant_accepts_threshold_range(env, thr):
    c, vm, a, b, s = env
    gid = create(c, vm, a, dev_hex(env), threshold=thr)
    assert c.get_grant(gid)["threshold_score"] == thr


def test_create_grant_requires_funding(env):
    c, vm, a, b, s = env
    with vm.expect_revert("ERR_INVALID_VALUE"):
        create(c, vm, a, dev_hex(env), value=0)


def test_create_grant_rejects_empty_title(env):
    c, vm, a, b, s = env
    with vm.expect_revert("ERR_INVALID_PARAMS"):
        create(c, vm, a, dev_hex(env), title="   ")


def test_create_grant_rejects_self_as_developer(env):
    c, vm, a, b, s = env
    with vm.expect_revert("ERR_INVALID_PARAMS"):
        create(c, vm, a, hexof(c, vm, a))


def test_create_grant_rejects_garbage_developer(env):
    c, vm, a, b, s = env
    with vm.expect_revert("ERR_INVALID_PARAMS"):
        create(c, vm, a, "not-an-address")


def test_create_grant_sanitizes_title(env):
    c, vm, a, b, s = env
    gid = create(c, vm, a, dev_hex(env), title="<script>x</script>Bridge")
    t = c.get_grant(gid)["title"]
    assert "<" not in t and ">" not in t


def test_create_grant_truncates_long_title(env):
    c, vm, a, b, s = env
    gid = create(c, vm, a, dev_hex(env), title="T" * 1000)
    assert len(c.get_grant(gid)["title"]) <= 160


def test_create_grant_locks_escrow(env):
    c, vm, a, b, s = env
    create(c, vm, a, dev_hex(env))
    m = c.get_protocol_metrics()
    assert m["locked_escrow"] == str(GRANT)
    assert m["total_funded"] == str(GRANT)
    assert m["total_grants"] == 1


def test_create_grant_spec_is_normalised(env):
    c, vm, a, b, s = env
    gid = create(c, vm, a, dev_hex(env), spec="{}")
    spec = json.loads(c.get_grant(gid)["spec_criteria"])
    assert spec["required_files"] == [] and spec["min_coverage"] == 0


@pytest.mark.parametrize("bad", [
    "not json", "[]", '"str"', '{"min_coverage": 101}', '{"min_coverage": -1}',
    '{"min_coverage": "90"}', '{"min_coverage": true}', '{"required_files": "a"}',
    '{"required_files": [1]}', '{"required_files": [""]}',
    '{"required_methods": ["bad name!"]}', '{"required_files": ["../../etc"]}'.replace("../../etc", "a b"),
    '{"forbidden_patterns": [""]}', '{"architecture": 5}',
    '{"forbidden_patterns": ["a", "e", "i", "o", "u"]}', '{"forbidden_patterns": ["ab"]}',
    json.dumps({"required_files": ["f%d" % i for i in range(13)]}),
    json.dumps({"required_methods": ["m%d" % i for i in range(25)]}),
])
def test_create_grant_rejects_malformed_spec(env, bad):
    c, vm, a, b, s = env
    with vm.expect_revert("ERR_INVALID_PARAMS"):
        create(c, vm, a, dev_hex(env), spec=bad)


# ---- submit_deliverable ----------------------------------------------------
def test_submit_moves_to_delivered_and_locks_bond(env):
    c, vm, a, b, s = env
    gid = create(c, vm, a, dev_hex(env))
    submit(c, vm, b, gid)
    g = c.get_grant(gid)
    assert g["status"] == "DELIVERED" and g["commit_sha"] == SHA and g["attempts"] == 1
    assert g["developer_bond"] == str(BOND)
    assert c.get_protocol_metrics()["locked_bonds"] == str(BOND)


def test_submit_only_developer(env):
    c, vm, a, b, s = env
    gid = create(c, vm, a, dev_hex(env))
    with vm.expect_revert("ERR_UNAUTHORIZED"):
        submit(c, vm, s, gid)


def test_funder_cannot_submit(env):
    c, vm, a, b, s = env
    gid = create(c, vm, a, dev_hex(env))
    with vm.expect_revert("ERR_UNAUTHORIZED"):
        submit(c, vm, a, gid)


@pytest.mark.parametrize("value", [0, 1, BOND - 1, BOND + 1, 2 * BOND])
def test_submit_requires_exact_bond(env, value):
    c, vm, a, b, s = env
    gid = create(c, vm, a, dev_hex(env))
    with vm.expect_revert("ERR_INVALID_VALUE"):
        submit(c, vm, b, gid, value=value)


@pytest.mark.parametrize("sha", [
    "", "abc", "a" * 39, "a" * 41, "g" * 40, "z" * 40, "0x" + "a" * 38, " " * 40,
])
def test_submit_rejects_malformed_sha(env, sha):
    c, vm, a, b, s = env
    gid = create(c, vm, a, dev_hex(env))
    with vm.expect_revert("ERR_INVALID_PARAMS"):
        submit(c, vm, b, gid, sha=sha)


def test_submit_normalises_uppercase_sha(env):
    c, vm, a, b, s = env
    gid = create(c, vm, a, dev_hex(env))
    submit(c, vm, b, gid, sha=("A" * 39 + "1"))
    assert c.get_grant(gid)["commit_sha"] == "a" * 39 + "1"


@pytest.mark.parametrize("url", [
    "", "http://github.com/acme/bridge", "https://gitlab.com/acme/bridge",
    "https://github.com/acme", "https://github.com/acme/bridge/pull/1",
    "https://evil.com/github.com/acme/bridge", "ftp://github.com/a/b",
    "https://github.com/../bridge",
])
def test_submit_rejects_bad_repo_url(env, url):
    c, vm, a, b, s = env
    gid = create(c, vm, a, dev_hex(env))
    with vm.expect_revert("ERR_INVALID_PARAMS"):
        submit(c, vm, b, gid, repo=url)


def test_submit_twice_is_rejected(env):
    c, vm, a, b, s = env
    gid = create(c, vm, a, dev_hex(env))
    submit(c, vm, b, gid)
    with vm.expect_revert("ERR_INVALID_STATE"):
        submit(c, vm, b, gid)


def test_submit_unknown_grant(env):
    c, vm, a, b, s = env
    with vm.expect_revert("ERR_INVALID_STATE"):
        submit(c, vm, b, 99)


def test_submit_grant_zero_is_unknown(env):
    c, vm, a, b, s = env
    with vm.expect_revert("ERR_INVALID_STATE"):
        submit(c, vm, b, 0)


# ---- cancel_grant ----------------------------------------------------------
def test_cancel_open_grant_too_early(env):
    c, vm, a, b, s = env
    gid = create(c, vm, a, dev_hex(env))
    vm.sender = a
    with vm.expect_revert("ERR_TOO_EARLY"):
        c.cancel_grant(gid)


def test_cancel_open_grant_after_delay_refunds_funder(env):
    c, vm, a, b, s = env
    gid = create(c, vm, a, dev_hex(env))
    vm.warp("2099-01-01T00:00:00Z")
    vm.sender = a
    c.cancel_grant(gid)
    assert c.get_grant(gid)["status"] == "CANCELLED"
    assert c.claimable_of(hexof(c, vm, a)) == str(GRANT)
    assert c.get_protocol_metrics()["locked_escrow"] == "0"


def test_cancel_only_funder(env):
    c, vm, a, b, s = env
    gid = create(c, vm, a, dev_hex(env))
    vm.warp("2099-01-01T00:00:00Z")
    vm.sender = b
    with vm.expect_revert("ERR_UNAUTHORIZED"):
        c.cancel_grant(gid)


def test_cancel_delivered_grant_blocked(env):
    c, vm, a, b, s = env
    gid = delivered(c, vm, a, b)
    vm.sender = a
    with vm.expect_revert("ERR_INVALID_STATE"):
        c.cancel_grant(gid)


def test_cancelled_grant_cannot_receive_deliverable(env):
    c, vm, a, b, s = env
    gid = create(c, vm, a, dev_hex(env))
    vm.warp("2099-01-01T00:00:00Z")
    vm.sender = a
    c.cancel_grant(gid)
    with vm.expect_revert("ERR_INVALID_STATE"):
        submit(c, vm, b, gid)


def test_cancel_twice_is_rejected(env):
    c, vm, a, b, s = env
    gid = create(c, vm, a, dev_hex(env))
    vm.warp("2099-01-01T00:00:00Z")
    vm.sender = a
    c.cancel_grant(gid)
    with vm.expect_revert("ERR_INVALID_STATE"):
        c.cancel_grant(gid)


# ---- views -----------------------------------------------------------------
def test_get_grant_unknown_reverts(env):
    c, vm, a, b, s = env
    with vm.expect_revert("ERR_INVALID_STATE"):
        c.get_grant(5)


def test_get_all_grants_lists_in_order(env):
    c, vm, a, b, s = env
    for i in range(3):
        create(c, vm, a, dev_hex(env), title=f"G{i}")
    titles = [g["title"] for g in c.get_all_grants()]
    assert titles == ["G0", "G1", "G2"]


def test_get_all_grants_empty(env):
    c, vm, a, b, s = env
    assert c.get_all_grants() == []


@pytest.mark.parametrize("sha,ok", [
    ("a" * 40, True), ("0" * 40, True), ("A" * 40, False), ("a" * 39, False),
    ("a" * 41, False), ("", False), ("g" * 40, False),
])
def test_is_valid_commit_sha(env, sha, ok):
    c, vm, a, b, s = env
    assert c.is_valid_commit_sha(sha) is ok
