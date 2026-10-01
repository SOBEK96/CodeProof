"""Pull-payments, strict escrow solvency, and protocol metrics."""

import pytest
from conftest import *


@pytest.fixture
def env(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c = direct_deploy(CONTRACT)
    return c, direct_vm, direct_alice, direct_bob, direct_charlie


def settle(env, scenario):
    """Drive one grant to `scenario`; returns (gid, expected_outcome)."""
    c, vm, a, b, s = env
    gid = delivered(c, vm, a, b)
    if scenario == "approved":
        mock_github(vm, report=good_report()); mock_score(vm, 94)
    elif scenario == "rejected":
        mock_github(vm, report=good_report()); mock_score(vm, 70)
    elif scenario == "fraud":
        mock_github(vm, files=[], patch=""); mock_score(vm, 90)
    elif scenario == "disputed":
        mock_github(vm, commit_status=404)
    return gid, evaluate(c, vm, s, gid)


def liabilities(c):
    m = c.get_protocol_metrics()
    return (int(m["locked_escrow"]) + int(m["locked_bonds"])
            + int(m["total_claimable"]) + int(m["treasury"]))


# ---- solvency: every bit of deposited value is accounted for ---------------
@pytest.mark.parametrize("scenario", ["approved", "rejected", "fraud", "disputed"])
def test_liabilities_equal_deposits_after_settlement(env, scenario):
    c = env[0]
    settle(env, scenario)
    assert liabilities(c) == GRANT + BOND


@pytest.mark.parametrize("scenario", ["approved", "rejected", "fraud", "disputed"])
def test_contract_solvent_after_settlement(env, scenario):
    c, vm = env[0], env[1]
    settle(env, scenario)
    assert sync_balance(c, vm)["solvent"] is True


def test_insolvent_when_balance_short(env):
    c, vm = env[0], env[1]
    settle(env, "approved")
    vm.deal(vm._contract_address, 1)
    assert c.get_protocol_metrics()["solvent"] is False


def test_liabilities_after_submission_before_evaluation(env):
    c, vm, a, b, s = env
    delivered(c, vm, a, b)
    assert liabilities(c) == GRANT + BOND


def test_liabilities_with_many_grants(env):
    c, vm, a, b, s = env
    total = 0
    for i in range(4):
        create(c, vm, a, hexof(c, vm, b), title=f"G{i}", value=(i + 1) * ATTO)
        total += (i + 1) * ATTO
    assert liabilities(c) == total


# ---- claim_payout -----------------------------------------------------------
def test_developer_claims_approved_payout(env):
    c, vm, a, b, s = env
    gid, _ = settle(env, "approved")
    vm.sender = b
    assert c.claim_payout(gid) == str(GRANT + BOND)
    assert c.claimable_of(hexof(c, vm, b)) == "0"
    assert c.get_protocol_metrics()["total_claimable"] == "0"


def test_claim_twice_reverts(env):
    c, vm, a, b, s = env
    gid, _ = settle(env, "approved")
    vm.sender = b
    c.claim_payout(gid)
    with vm.expect_revert("ERR_NO_CLAIMABLE_BALANCE"):
        c.claim_payout(gid)


def test_claim_by_outsider_reverts(env):
    c, vm, a, b, s = env
    gid, _ = settle(env, "approved")
    vm.sender = s
    with vm.expect_revert("ERR_UNAUTHORIZED"):
        c.claim_payout(gid)


def test_funder_has_nothing_to_claim_after_approval(env):
    c, vm, a, b, s = env
    gid, _ = settle(env, "approved")
    vm.sender = a
    with vm.expect_revert("ERR_NO_CLAIMABLE_BALANCE"):
        c.claim_payout(gid)


def test_funder_claims_refund_after_rejection(env):
    c, vm, a, b, s = env
    gid, _ = settle(env, "rejected")
    vm.sender = a
    assert c.claim_payout(gid) == str(GRANT)


def test_developer_claims_bond_refund_after_rejection(env):
    c, vm, a, b, s = env
    gid, _ = settle(env, "rejected")
    vm.sender = b
    assert c.claim_payout(gid) == str(BOND)


def test_funder_claims_compensation_after_fraud(env):
    c, vm, a, b, s = env
    gid, _ = settle(env, "fraud")
    vm.sender = a
    assert c.claim_payout(gid) == str(GRANT + BOND // 2)


def test_fraudulent_developer_cannot_claim(env):
    c, vm, a, b, s = env
    gid, _ = settle(env, "fraud")
    vm.sender = b
    with vm.expect_revert("ERR_NO_CLAIMABLE_BALANCE"):
        c.claim_payout(gid)


def test_developer_claims_refund_after_dispute(env):
    c, vm, a, b, s = env
    gid, _ = settle(env, "disputed")
    vm.sender = b
    assert c.claim_payout(gid) == str(BOND)


def test_claim_unknown_grant_reverts(env):
    c, vm, a, b, s = env
    vm.sender = b
    with vm.expect_revert("ERR_INVALID_STATE"):
        c.claim_payout(77)


def test_claim_before_evaluation_reverts(env):
    c, vm, a, b, s = env
    gid = delivered(c, vm, a, b)
    vm.sender = b
    with vm.expect_revert("ERR_NO_CLAIMABLE_BALANCE"):
        c.claim_payout(gid)


def test_claim_reduces_liabilities_by_exact_amount(env):
    c, vm, a, b, s = env
    gid, _ = settle(env, "approved")
    before = liabilities(c)
    vm.sender = b
    paid = int(c.claim_payout(gid))
    assert liabilities(c) == before - paid


def test_claim_pays_across_multiple_grants_in_one_call(env):
    c, vm, a, b, s = env
    g1, _ = settle(env, "approved")
    g2, _ = settle(env, "approved")
    vm.sender = b
    assert c.claim_payout(g1) == str(2 * (GRANT + BOND))


# ---- metrics ----------------------------------------------------------------
def test_metrics_initial(env):
    m = env[0].get_protocol_metrics()
    assert m["total_grants"] == 0 and m["mean_quality_score_x100"] == 0
    assert m["active_arbitrations"] == 0 and m["solvent"] is True


def test_metrics_active_arbitrations_counts_delivered(env):
    c, vm, a, b, s = env
    delivered(c, vm, a, b)
    delivered(c, vm, a, b)
    assert c.get_protocol_metrics()["active_arbitrations"] == 2


def test_metrics_mean_score(env):
    settle(env, "approved")   # 94
    settle(env, "rejected")   # 70
    m = env[0].get_protocol_metrics()
    assert m["mean_quality_score_x100"] == 8200 and m["evaluated_count"] == 2
    assert m["approved"] == 1 and m["rejected"] == 1


def test_metrics_disbursed_only_counts_approved(env):
    settle(env, "approved")
    settle(env, "rejected")
    assert env[0].get_protocol_metrics()["total_disbursed"] == str(GRANT)


def test_metrics_disputed_count(env):
    settle(env, "disputed")
    m = env[0].get_protocol_metrics()
    assert m["disputed"] == 1 and m["active_arbitrations"] == 0


def test_metrics_total_funded_accumulates(env):
    c, vm, a, b, s = env
    create(c, vm, a, hexof(c, vm, b), value=2 * ATTO)
    create(c, vm, a, hexof(c, vm, b), value=3 * ATTO)
    assert c.get_protocol_metrics()["total_funded"] == str(5 * ATTO)


def test_claimable_of_is_case_insensitive(env):
    c, vm, a, b, s = env
    settle(env, "approved")
    h = hexof(c, vm, b)
    assert c.claimable_of(h.lower()) == c.claimable_of(h) == str(GRANT + BOND)


def test_claimable_of_unknown_is_zero(env):
    assert env[0].claimable_of("0x" + "1" * 40) == "0"


# ---- compute_bounds (the mathematical corridor) ----------------------------
import json as _json

TEL = dict(files_total=2, additions=40, deletions=0, req_files_total=2, req_files_found=2,
           methods_total=3, methods_found=3, forbidden_hits=0, has_report=True,
           tests_passed=42, tests_failed=0, coverage=100)


def bounds(c, min_cov=90, **over):
    t = dict(TEL); t.update(over)
    return c.compute_bounds(_json.dumps(t), min_cov)


def test_bounds_weakest_criterion_governs(env):
    # methods 1/3 -> weakest .333 -> [20, 43], however good everything else is
    assert bounds(env[0], methods_found=1) == {"lo": 20, "hi": 43}


def test_bounds_perfect(env):
    assert bounds(env[0]) == {"lo": 60, "hi": 100}


@pytest.mark.parametrize("over,hi_max", [
    (dict(req_files_found=0), 85), (dict(methods_found=0), 85),
    (dict(tests_passed=0), 85), (dict(coverage=0), 85),
    (dict(forbidden_hits=2), 80),
])
def test_bounds_single_failure_blocks_default_approval(env, over, hi_max):
    assert bounds(env[0], **over)["hi"] <= hi_max


def test_bounds_empty_commit_capped_at_20(env):
    assert bounds(env[0], files_total=0, additions=0)["hi"] <= 20


def test_bounds_lo_never_exceeds_hi(env):
    b = bounds(env[0], forbidden_hits=10)
    assert 0 <= b["lo"] <= b["hi"] <= 100


def test_bounds_hi_clamped_to_zero(env):
    assert bounds(env[0], forbidden_hits=50, tests_passed=0, methods_found=0)["hi"] == 0


def test_bounds_no_coverage_requirement_ignores_coverage(env):
    assert bounds(env[0], min_cov=0, coverage=-1, has_report=False)["hi"] == 100


def test_bounds_failed_tests_halve_test_score(env):
    assert bounds(env[0], tests_passed=10, tests_failed=10)["hi"] < bounds(env[0])["hi"]


def test_bounds_rejects_malformed_json(env):
    with env[1].expect_revert("ERR_INVALID_PARAMS"):
        env[0].compute_bounds("{}", 0)
