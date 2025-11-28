#!/usr/bin/env python3
"""
Gradio Web UI for Testing Fine-Tuned DeepSeek-Coder

Install dependencies:
    pip install gradio mlx-lm

Run:
    python ui_test.py
"""

import gradio as gr
from mlx_lm import load, generate
from pathlib import Path

# Configuration
MODEL_NAME = "deepseek-ai/deepseek-coder-1.3b-instruct"
ADAPTER_PATH = Path.home() / "ai" / "screenpipe" / "training_pipeline" / "output" / "adapters"

# Load models (cached globally to avoid reloading)
print("Loading base model...")
base_model, base_tokenizer = load(MODEL_NAME)
print("✓ Base model loaded")

print("Loading fine-tuned model (with adapters)...")
finetuned_model, finetuned_tokenizer = load(MODEL_NAME, adapter_path=str(ADAPTER_PATH))
print("✓ Fine-tuned model loaded")


def generate_code(prompt: str, use_finetuned: bool, max_tokens: int, temperature: float) -> str:
    """Generate code using selected model"""

    model = finetuned_model if use_finetuned else base_model
    tokenizer = finetuned_tokenizer if use_finetuned else base_tokenizer

    try:
        # Generate
        output = generate(
            model=model,
            tokenizer=tokenizer,
            prompt=prompt,
            max_tokens=max_tokens,
            temp=temperature,
            verbose=False
        )

        return output

    except Exception as e:
        return f"❌ Error: {str(e)}"


def compare_models(prompt: str, max_tokens: int, temperature: float):
    """Generate with both models for comparison"""

    base_output = generate_code(prompt, use_finetuned=False, max_tokens=max_tokens, temperature=temperature)
    finetuned_output = generate_code(prompt, use_finetuned=True, max_tokens=max_tokens, temperature=temperature)

    return base_output, finetuned_output


# Example prompts from training data
EXAMPLE_PROMPTS = [
    """release-app make onboarding stream properly screenshots

Screen Context from screenpipe - screenpipe:

screenpipescreenpipeWatch video on YouTubeError 153Video player configuration errorskip onboardingget started →

Task: Modify screenpipe-app-tauri/components/onboarding/introduction.tsx""",

    """Add authentication middleware

Screen Context from VS Code - middleware.ts:

export function middleware(req: Request) {
  // TODO: Add auth check
  return NextResponse.next()
}

Task: Modify app/middleware.ts""",
]


# Create Gradio Interface
with gr.Blocks(title="DeepSeek-Coder Test UI", theme=gr.themes.Soft()) as demo:

    gr.Markdown("""
    # 🧪 DeepSeek-Coder Fine-Tuning Test UI

    Test your fine-tuned model vs the base model. The fine-tuned version has been trained on 5 screenpipe code examples.
    """)

    with gr.Tab("Single Generation"):
        gr.Markdown("### Generate code with one model")

        with gr.Row():
            with gr.Column(scale=3):
                prompt_input = gr.Textbox(
                    label="Prompt",
                    placeholder="Enter your code generation prompt...",
                    lines=10,
                    value=EXAMPLE_PROMPTS[0]
                )

                with gr.Row():
                    use_finetuned = gr.Checkbox(label="Use Fine-Tuned Model", value=True)
                    max_tokens = gr.Slider(minimum=50, maximum=1000, value=300, step=50, label="Max Tokens")
                    temperature = gr.Slider(minimum=0.0, maximum=1.5, value=0.7, step=0.1, label="Temperature")

                generate_btn = gr.Button("🚀 Generate Code", variant="primary")

            with gr.Column(scale=3):
                output = gr.Textbox(label="Generated Code", lines=20)

        generate_btn.click(
            fn=generate_code,
            inputs=[prompt_input, use_finetuned, max_tokens, temperature],
            outputs=output
        )

    with gr.Tab("Compare Models"):
        gr.Markdown("### Side-by-side comparison: Base vs Fine-Tuned")

        with gr.Row():
            with gr.Column():
                compare_prompt = gr.Textbox(
                    label="Prompt",
                    placeholder="Enter prompt to compare...",
                    lines=10,
                    value=EXAMPLE_PROMPTS[0]
                )

                with gr.Row():
                    compare_max_tokens = gr.Slider(minimum=50, maximum=1000, value=300, step=50, label="Max Tokens")
                    compare_temp = gr.Slider(minimum=0.0, maximum=1.5, value=0.7, step=0.1, label="Temperature")

                compare_btn = gr.Button("⚖️  Compare", variant="primary")

        with gr.Row():
            with gr.Column():
                gr.Markdown("**Base Model Output**")
                base_output = gr.Textbox(label="Base Model", lines=20)

            with gr.Column():
                gr.Markdown("**Fine-Tuned Model Output**")
                finetuned_output = gr.Textbox(label="Fine-Tuned Model", lines=20)

        compare_btn.click(
            fn=compare_models,
            inputs=[compare_prompt, compare_max_tokens, compare_temp],
            outputs=[base_output, finetuned_output]
        )

    with gr.Tab("Example Prompts"):
        gr.Markdown("### Training Data Examples")
        gr.Markdown("These prompts are from the 5 training pairs. The fine-tuned model should perform well on these.")

        for i, example in enumerate(EXAMPLE_PROMPTS, 1):
            with gr.Accordion(f"Example {i}", open=(i == 1)):
                gr.Textbox(value=example, lines=10, show_copy_button=True)

    with gr.Tab("Model Info"):
        gr.Markdown(f"""
        ### Model Configuration

        **Base Model:** `{MODEL_NAME}`
        - Parameters: 1.3B
        - Context Length: 2048 tokens
        - Training: Code-specialized (2T tokens)

        **Fine-Tuned Adapters:** `{ADAPTER_PATH}`
        - Method: LoRA (Low-Rank Adaptation)
        - Trainable Params: 2.5M (0.186%)
        - Training Pairs: 5
        - Training Loss: 1.380 → 0.016

        **⚠️ Overfitting Warning:**
        - Only 5 training pairs = severe overfitting
        - Model memorized examples, didn't learn patterns
        - Will fail on new scenarios

        **Recommended Next Steps:**
        1. Generate 50-200 more training pairs
        2. Lower confidence threshold (0.6 → 0.4)
        3. Add document sources (.github/workflows, docs)
        4. Enable audio transcription for more context
        """)


if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("Starting Gradio UI on http://localhost:7860")
    print("=" * 80)

    demo.launch(
        server_name="127.0.0.1",
        server_port=7860,
        share=False,  # Set to True to create public link
        show_error=True
    )
