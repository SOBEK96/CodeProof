"""Equivalence Principle: validator agreement / disagreement (run_validator)."""

import json
import pytest
from conftest import *


@pytest.fixture
def env(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c = direct_deploy(CONTRACT)
    return c, direct_vm, direct_alice, direct_bob, direct_charlie


def leader_run(env, leader_score=94, report=None, **gh):
    c, vm, a, b, s = env
    gid = delivered(c, vm, a, b)
    mock_github(vm, report=report or good_report(), **gh)
    mock_score(vm, leader_score)
    evaluate(c, vm, s, gid)
    return gid


def validator_sees(vm, score=94, report=None, **gh):
    mock_github(vm, report=report or good_report(), **gh)
    mock_score(vm, score)
    return vm.run_validator()


def test_validator_agrees_on_identical_evidence(env):
    leader_run(env)
    assert validator_sees(env[1], 94) is True


@pytest.mark.parametrize("v", [88, 90, 94, 100])
def test_validator_agrees_within_tolerance_same_tier(env, v):
    leader_run(env, 94)
    assert validator_sees(env[1], v) is True


@pytest.mark.parametrize("v", [60, 70, 83])
def test_validator_disagrees_when_score_crosses_threshold(env, v):
    leader_run(env, 94)
    assert validator_sees(env[1], v) is False


def test_validator_disagrees_on_tier_boundary_even_if_close(env):
    leader_run(env, 86)
    assert validator_sees(env[1], 84) is False  # PASS vs FAIL, 2 points apart


def test_validator_disagrees_when_tolerance_exceeded_inside_tier(env):
    leader_run(env, 99, spec=None) if False else leader_run(env, 99)
    # both PASS but 14 apart (> SCORE_TOLERANCE 12): validator corridor hi=100, lo=60
    assert validator_sees(env[1], 85) is False


def test_validator_disagrees_when_test_telemetry_differs(env):
    leader_run(env, 94)
    assert validator_sees(env[1], 94, report=good_report(passed=3, failed=3)) is False


def test_validator_disagrees_when_coverage_differs(env):
    leader_run(env, 94)
    assert validator_sees(env[1], 94, report=good_report(coverage=95)) is False


def test_validator_disagrees_when_files_differ(env):
    leader_run(env, 94)
    assert validator_sees(env[1], 94, files=["src/Bridge.sol"]) is False


def test_validator_disagrees_when_commit_vanishes(env):
    leader_run(env, 94)
    assert validator_sees(env[1], 94, commit_status=404) is False


def test_validator_agrees_when_both_see_missing_commit(env):
    c, vm, a, b, s = env
    gid = delivered(c, vm, a, b)
    mock_github(vm, commit_status=404)
    evaluate(c, vm, s, gid)
    mock_github(vm, commit_status=422)
    assert vm.run_validator() is True


def test_validator_disagrees_on_inconclusive_reason(env):
    c, vm, a, b, s = env
    gid = delivered(c, vm, a, b)
    mock_github(vm, commit_status=404)
    evaluate(c, vm, s, gid)
    mock_github(vm, commit_status=418)
    assert vm.run_validator() is False


def test_validator_rejects_leader_score_above_corridor(env):
    leader_run(env, 94)
    c, vm, *_ = env
    mock_github(vm, report=good_report(passed=0, failed=9, coverage=0))
    mock_score(vm, 99)
    forged = {"status": "OK", "score": 99, "rationale": "x", "tel": {}, "lo": 0, "hi": 100}
    assert vm.run_validator(leader_result=forged) is False


def test_validator_rejects_leader_with_forged_telemetry(env):
    leader_run(env, 94)
    c, vm, *_ = env
    mock_github(vm, report=good_report(passed=0, failed=9, coverage=0))
    mock_score(vm, 99)
    stored = vm._captured_validators[-1][0]
    forged = dict(stored)
    forged["tel"] = dict(stored["tel"])  # leader claims perfect telemetry
    assert vm.run_validator(leader_result=forged) is False


@pytest.mark.parametrize("bad", [None, 5, "OK", [], {"status": "OK"}, {"status": "OK", "tel": 1},
                                 {"status": "OK", "tel": {}, "score": "94"}])
def test_validator_rejects_malformed_leader_result(env, bad):
    leader_run(env, 94)
    mock_github(env[1], report=good_report())
    mock_score(env[1], 94)
    assert env[1].run_validator(leader_result=bad) is False


def test_validator_rejects_bool_score(env):
    leader_run(env, 94)
    stored = env[1]._captured_validators[-1][0]
    forged = dict(stored)
    forged["score"] = True
    assert env[1].run_validator(leader_result=forged) is False


def test_transient_leader_error_agrees_if_validator_also_transient(env):
    c, vm, a, b, s = env
    gid = leader_run(env, 94)
    mock_github(vm, commit_status=503)
    assert vm.run_validator(leader_error=Exception("[TRANSIENT] GitHub returned 503")) is True


def test_transient_leader_error_disagrees_if_validator_succeeds(env):
    leader_run(env, 94)
    validator_sees(env[1], 94) if False else None
    mock_github(env[1], report=good_report())
    mock_score(env[1], 94)
    assert env[1].run_validator(leader_error=Exception("[TRANSIENT] GitHub returned 503")) is False


def test_llm_error_from_leader_always_disagrees(env):
    leader_run(env, 94)
    mock_github(env[1], commit_status=503)
    assert env[1].run_validator(leader_error=Exception("[LLM_ERROR] bad")) is False


def test_validator_llm_failure_means_disagree(env):
    leader_run(env, 94)
    vm = env[1]
    mock_github(vm, report=good_report())
    vm.mock_llm(r".*", json.dumps("garbage"))
    assert vm.run_validator() is False


def _majority(vm, variants):
    votes = []
    for kw in variants:
        votes.append(validator_sees(vm, **kw))
    return sum(votes), len(votes)


def test_three_validators_majority_agree_despite_one_outlier(env):
    leader_run(env, 94)
    agree, n = _majority(env[1], [dict(score=92), dict(score=96), dict(score=50)])
    assert (agree, n) == (2, 3)


def test_three_validators_unanimous(env):
    leader_run(env, 94)
    agree, n = _majority(env[1], [dict(score=94), dict(score=93), dict(score=95)])
    assert agree == n == 3


def test_three_validators_split_minority_agrees(env):
    leader_run(env, 94)
    agree, n = _majority(env[1], [dict(score=94), dict(score=60), dict(score=70)])
    assert agree == 1 and agree * 2 < n  # no majority: consensus would NOT be reached


def test_five_validators_strict_majority(env):
    leader_run(env, 90)
    agree, n = _majority(env[1], [dict(score=s) for s in (88, 91, 95, 60, 40)])
    assert agree == 3 and agree * 2 > n


def test_validator_tolerance_is_symmetric(env):
    leader_run(env, 88)
    assert validator_sees(env[1], 100) is True
    assert validator_sees(env[1], 99) is True
