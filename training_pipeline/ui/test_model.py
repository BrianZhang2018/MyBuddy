#!/usr/bin/env python3
"""
Test the fine-tuned DeepSeek-Coder model with adapters
"""

import subprocess
from pathlib import Path

CONFIG = {
    "model": "deepseek-ai/deepseek-coder-1.3b-instruct",
    "adapter_path": Path.home() / "ai" / "screenpipe" / "training_pipeline" / "output" / "adapters",
    "max_tokens": 512,
    "temp": 0.7,
}

# Test prompts
TEST_PROMPTS = [
    # Similar to training data (should work well)
    {
        "name": "Video Player Fix (from training)",
        "prompt": """release-app make onboarding stream properly screenshots

Screen Context from screenpipe - screenpipe:

screenpipescreenpipeWatch video on YouTubeError 153Video player configuration errorskip onboardingget started →

Task: Modify screenpipe-app-tauri/components/onboarding/introduction.tsx"""
    },

    # New scenario (will likely fail)
    {
        "name": "New Feature Request",
        "prompt": """Add dark mode toggle to settings page

Screen Context from VS Code - settings.tsx:

Settings
Theme: Light
Language: English
Save Settings

Task: Modify app/settings/page.tsx"""
    },
]


def test_prompt(name: str, prompt: str):
    """Test a single prompt"""
    print(f"\n{'=' * 80}")
    print(f"Test: {name}")
    print(f"{'=' * 80}")
    print(f"\nPrompt:\n{prompt[:200]}...\n")

    cmd = [
        "mlx_lm.generate",
        "--model", str(CONFIG["model"]),
        "--adapter-path", str(CONFIG["adapter_path"]),
        "--max-tokens", str(CONFIG["max_tokens"]),
        "--temp", str(CONFIG["temp"]),
        "--prompt", prompt,
    ]

    print("Generating...")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

        if result.returncode == 0:
            # Extract just the generated text (after the prompt)
            output = result.stdout.strip()
            print(f"\nGenerated Code:\n{'-' * 80}")
            print(output)
            print(f"{'-' * 80}")
        else:
            print(f"❌ Generation failed: {result.stderr}")

    except subprocess.TimeoutExpired:
        print("❌ Generation timed out (>60s)")
    except Exception as e:
        print(f"❌ Error: {e}")


def main():
    print("=" * 80)
    print("Testing Fine-Tuned DeepSeek-Coder")
    print("=" * 80)

    # Test each prompt
    for test in TEST_PROMPTS:
        test_prompt(test["name"], test["prompt"])

    print(f"\n{'=' * 80}")
    print("Testing Complete!")
    print(f"{'=' * 80}")
    print("\nObservations:")
    print("- First prompt (from training): Should generate iframe code")
    print("- Second prompt (new scenario): Will likely fail or hallucinate")
    print("- This demonstrates overfitting on 5 training pairs")


if __name__ == "__main__":
    main()
