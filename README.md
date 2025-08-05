# InsightGUIDE

This repository contains the code and supplementary material for the ICTAI 2025 submission introducing InsightGUIDE.

## Abstract

The proliferation of scientific literature presents an increasingly significant challenge for researchers. While Large Language Models (LLMs) offer promise, existing tools often provide verbose summaries that risk replacing, rather than assisting, the reading of the source material. This paper introduces InsightGUIDE, a novel AI-powered tool designed to function as a reading assistant, not a replacement. Our system provides concise, structured insights that act as a ``map'' to a paper's key elements by embedding an expert's reading methodology directly into its core AI logic. We present the system's architecture, its prompt-driven methodology, and a qualitative case study comparing its output to a general-purpose LLM. The results demonstrate that InsightGUIDE produces more structured and actionable guidance, serving as a more effective tool for the modern researcher.

## Live Demo

**Demo URL**: <https://insightguide.vercel.app/>

**Access Credentials**:

- **Username**: `review`
- **Password**: `review`

> *Note: The demo environment may face some latency issues when it comes to processing new papers (~3 min/paper), it is highly recommended to use the pre-loaded papers to get an understanding of the system's capabilities.*


## Overview

InsightGUIDE consists of two main components:

### Backend API Service

A FastAPI-based REST API that handles PDF processing and AI analysis.

**Location**: [`InsightGUIDE/backend-api/`](./InsightGUIDE/backend-api/)

**Key Technologies**:

- FastAPI with async support
- Mistral AI for OCR processing
- OpenAI/Compatible APIs for insights generation

**[📖 Backend Documentation](./InsightGUIDE/backend-api/README.md)**

### Frontend Web UI

A Next.js web application providing the user interface for paper analysis.

**Location**: [`InsightGUIDE/frontend-web-ui/`](./InsightGUIDE/frontend-web-ui/)

**Key Technologies**:

- Next.js 14+ with App Router
- React with TypeScript
- Tailwind CSS with ShadCN UI components

**[📖 Frontend Documentation](./InsightGUIDE/frontend-web-ui/README.md)**

## Preliminary Evaluation

This repository includes a qualitative comparison study presented in the paper, demonstrating InsightGUIDE's effectiveness compared to general-purpose LLMs. The evaluation uses the seminal paper "Attention is All You Need" (Vaswani et al., 2017) as a test case.

### Comparison Materials

The `comparison/` folder contains:

- **[1706.03762v7.pdf](./comparison/1706.03762v7.pdf)** - Original "Attention is All You Need" paper
- **[1706.03762v7.txt](./comparison/1706.03762v7.txt)** - Base DeepSeek-R1 analysis (general-purpose LLM output)
- **[1706.03762v7.md](./comparison/1706.03762v7.md)** - InsightGUIDE analysis using DeepSeek-R1 as backbone

### Key Findings

- **Structural Deconstruction**: Provides distinct analysis for Abstract & Introduction, Methods, Results, and Discussion sections vs. a single, monolithic summary paragraph
- **Key Contribution Identification**: Explicitly identifies "Transformer Architecture: First purely attention-based sequence model, enabling parallelization" vs. generic introductory statements
- **Methodological Limitations**: Highlights specific concerns like "O(n²) Complexity: Scalability concern for very long sequences" vs. no limitations mentioned
- **Preemptive Critical Questions**: Addresses "Problem-Method Alignment: Attention eliminates sequential computation, directly addressing RNN bottlenecks..." vs. no critical questions posed
- **Reference to In-Paper Evidence**: Cites specific tables and figures for validation vs. no references to supporting evidence
- **Actionable Reader Guidance**: Provides structured navigation paths like "For Technical Implementation: Start with Section 3 (Model Architecture) → Section 5 (Training)..." vs. no navigational guidance
- **Output Format**: Structured with headers, bullet points, and visual "Priority Signals" vs. dense paragraph of continuous prose

> More examples of PDF-InsightGUIDE MD outputs can be found in the [InsightGUIDE/frontend-web-ui/public/data/preload](./InsightGUIDE/frontend-web-ui/public/data/preload) folder (also avalable in the live demo by using the "Load Example Paper" functionality).

## Project Structure

```text
InsightGUIDE-ICTAI25/
├── README.md                           # This file
├── comparison/                         # Preliminary evaluation materials
│   ├── 1706.03762v7.md                # InsightGUIDE analysis of "Attention is All You Need"
│   ├── 1706.03762v7.pdf               # Original "Attention is All You Need" paper
│   └── 1706.03762v7.txt               # Base DeepSeek-R1 analysis for comparison
└── InsightGUIDE/
    ├── backend-api/                    # FastAPI backend service
    │   ├── README.md                   # Backend documentation
    │   ├── main.py                     # API entry point
    │   ├── config.py                   # Configuration management
    │   ├── services.py                 # Business logic services
    │   ├── models.py                   # API schemas
    │   ├── requirements.txt            # Python dependencies
    │   ├── system_prompts.yaml         # AI prompt templates
    │   └── tests/                      # Test suite
    │
    └── frontend-web-ui/                # Next.js web application
        ├── README.md                   # Frontend documentation
        ├── package.json                # Node dependencies
        ├── next.config.ts              # Next.js configuration
        ├── src/
        │   ├── app/                    # App router pages
        │   ├── components/             # React components
        │   ├── hooks/                  # Custom hooks
        │   └── lib/                    # Utilities
        └── public/
            └── data/preload/           # Example papers
```

## License

This project is licensed under the MIT License.

## Related Links

- [Backend API Documentation](./InsightGUIDE/backend-api/README.md)
- [Frontend UI Documentation](./InsightGUIDE/frontend-web-ui/README.md)
- [Live Demo](https://placeholder.com)
