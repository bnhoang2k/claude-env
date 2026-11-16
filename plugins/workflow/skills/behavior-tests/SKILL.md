---
name: behavior-tests
description: Use when writing or reviewing tests for any feature or bugfix. A test that fails only because the function does not exist yet proves little. This skill proves each test can fail when the code it guards breaks, by planting a fault.
---

# Behavior tests

A test that fails only because the function does not exist yet proves the test can fail. It does not prove the test fails when the code it guards breaks. A planted fault (see "Planted fault" below) is the real proof.

Spec, plan and subagent-driven work point here. They do not restate these steps.

## Behaviors, confirmed

List the behaviors the work must have, in plain words, from the conversation. Read the list back to the user. Get a yes before you write any test.

List unstated cases as proposals, not facts. Examples: empty input, failure paths, "obviously never" cases.

- With a spec: the list is the spec's `## Behaviors` section.
- Small work (no spec): put the behavior list in a comment block at the top of the test file.

## One test per behavior

Write one test for each confirmed behavior. Call the code through its public interface, the way callers use it. Do not test internal details.

Use no mocks. Mock a dependency only when the real one cannot run in a test.

## Planted fault

Do this for each critical behavior.

1. Break the code the test guards. The plan names the break. Without a plan, pick the smallest wrong-behavior edit: flip a condition, return a wrong value, skip a step. The broken code must still load and run. The test must fail on its assertion, not on an import, name, syntax or crash error.
2. Run the test. Show that it fails.
3. Restore the code. Run the test again. Show that it passes.

The failing output is the evidence. Paste it into your report.

For a bug fix, the test going red on the unfixed code is the planted-fault evidence, provided it fails on its assertion and not on a crash or missing symbol.

Writing the test first is allowed. It is not required.

## Delete tests that never fail

A test that no planted fault can turn red guards nothing. Delete it. Do not keep it for comfort.
