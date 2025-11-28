#!/usr/bin/env python3
"""
Simple Gradio UI for Testing Fine-Tuned DeepSeek-Coder
Uses subprocess calls for fast startup

Install: pip install gradio
Run: python ui_simple.py
"""

import gradio as gr
import subprocess
from pathlib import Path

# Configuration
MODEL = "deepseek-ai/deepseek-coder-1.3b-instruct"
ADAPTER_PATH = Path.home() / "ai" / "screenpipe" / "training_pipeline" / "output" / "adapters"

def generate_code(prompt: str, use_adapters: bool, max_tokens: int, temperature: float):
    """Generate code using mlx_lm.generate"""

    cmd = [
        "mlx_lm.generate",
        "--model", MODEL,
        "--max-tokens", str(max_tokens),
        "--temp", str(temperature),
        "--prompt", prompt,
    ]

    if use_adapters:
        cmd.extend(["--adapter-path", str(ADAPTER_PATH)])

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

        if result.returncode == 0:
            return result.stdout.strip()
        else:
            return f"❌ Error:\n{result.stderr}"

    except subprocess.TimeoutExpired:
        return "❌ Generation timed out (>120s)"
    except Exception as e:
        return f"❌ Error: {str(e)}"

# Example prompts
EXAMPLES = [
    """release-app make onboarding stream properly screenshots

Screen Context from screenpipe - screenpipe:

screenpipescreenpipeWatch video on YouTubeError 153Video player configuration errorskip onboardingget started →

Task: Modify screenpipe-app-tauri/components/onboarding/introduction.tsx""",

    """Fix authentication bug in middleware

Screen Context from VS Code - middleware.ts:

export function middleware(req: Request) {
  return NextResponse.next()
}

Task: Modify app/middleware.ts to add auth check""",
]

# Create UI
with gr.Blocks(title="DeepSeek-Coder Test", theme=gr.themes.Soft()) as app:

    gr.Markdown("""
    # 🧪 DeepSeek-Coder Fine-Tuning Test

    Test your fine-tuned model (5 training pairs). Toggle between base model and fine-tuned version.
    """)

    with gr.Row():
        with gr.Column(scale=2):
            prompt = gr.Textbox(
                label="Prompt",
                placeholder="Enter your prompt...",
                lines=12,
                value=EXAMPLES[0]
            )

            with gr.Row():
                use_adapters = gr.Checkbox(label="Use Fine-Tuned Adapters", value=True)
                max_tokens = gr.Slider(50, 1000, value=400, step=50, label="Max Tokens")
                temperature = gr.Slider(0.0, 1.5, value=0.7, step=0.1, label="Temperature")

            generate_btn = gr.Button("🚀 Generate", variant="primary", size="lg")

        with gr.Column(scale=3):
            output = gr.Textbox(label="Generated Output", lines=25, show_copy_button=True)

    generate_btn.click(
        fn=generate_code,
        inputs=[prompt, use_adapters, max_tokens, temperature],
        outputs=output
    )

    with gr.Accordion("📝 Example Prompts", open=False):
        for i, example in enumerate(EXAMPLES, 1):
            gr.Textbox(label=f"Example {i}", value=example, lines=8, interactive=False)

    gr.Markdown("""
    ### ℹ️ About

    **Model:** DeepSeek-Coder-1.3B-Instruct
    **Adapters:** LoRA trained on 5 screenpipe code examples
    **Training Loss:** 1.380 → 0.016 (severe overfitting)

    ⚠️ **Note:** Model only knows 5 scenarios and will fail on new tasks. Need 50-200+ training pairs.
    """)

if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("Starting Gradio UI at http://localhost:7860")
    print("=" * 70 + "\n")

    app.launch(
        server_name="127.0.0.1",
        server_port=7860,
        share=False,
        show_error=True
    )
