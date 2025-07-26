# InsightGUIDE Frontend Web UI

A web application for analyzing scientific papers and PDF documents using AI-powered insights. Built with Next.js, React, and TypeScript, featuring a two-pane interface for simultaneous PDF viewing and analysis results.

## Features

- **PDF Upload & Processing**: Upload PDF documents from your local device with drag-and-drop support
- **URL Loading**: Load PDFs directly from web URLs with smart toggle behavior
- **AI-Powered Analysis**: Extract insights from scientific papers using backend API integration
- **Dual-Pane Interface**: View original PDF alongside generated insights simultaneously
- **Save Insights**: Download generated insights as Markdown files with automatic naming
- **Advanced PDF Viewer**: Full-featured viewer with zoom controls, page navigation, maximize/minimize, and page persistence across view transitions
- **Responsive Design**: Optimized layout that adapts to different screen sizes
- **Real-time Processing**: Visual loading indicators during PDF analysis
- **Smart Error Handling**: Context-aware error messages with automatic recovery
- **Markdown Support**: Rich formatting for analysis results with GitHub Flavored Markdown, tables, code blocks, and LaTeX math rendering
- **Example Papers**: Preloaded demonstration papers with generated insights (toggleable via environment variable)

## Project Structure

```
frontend-web-ui/
├── src/
│   ├── app/                # Next.js app router pages and layouts
│   ├── components/         # Reusable React components
│   │   └── ui/             # ShadCN UI components
│   ├── hooks/              # Custom React hooks
│   └── lib/                # Utility functions and configurations
│
└── public/                 # Static assets and files
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18.x or later)
- [npm](https://www.npmjs.com/)
- The backend API service for PDF processing


### Installation

From the `frontent-web-ui` root directory, run:

   ```bash
   npm install
   ```

### Environment Variables

Create a `.env.local` file in the root directory and configure the following:

```env
NEXT_PUBLIC_HOST_IP=http://localhost:8000
NEXT_PUBLIC_ENABLE_TESTING=false
NEXT_PUBLIC_ENABLE_PRELOAD=true 
ENABLE_PASSWORD_PROTECTION=true 
USERNAME=your_username
PASSWORD=your_password
```

- `NEXT_PUBLIC_HOST_IP`: URL of your backend API endpoint that processes PDFs and returns insights
- `NEXT_PUBLIC_ENABLE_TESTING`: Set to `true` to enable testing functionality (test button in Insights card). Default is `false` if not set.
- `NEXT_PUBLIC_ENABLE_PRELOAD`: Set to `true` to enable preload functionality (example papers toggle). Default is `false` if not set.
- `ENABLE_PASSWORD_PROTECTION`: Set to `true` to enable password protection via browser authentication dialog. Default is `false` if not set.
- `USERNAME`: The username required for access when password protection is enabled. **Required** when `ENABLE_PASSWORD_PROTECTION=true`.
- `PASSWORD`: The password required for access when password protection is enabled. **Required** when `ENABLE_PASSWORD_PROTECTION=true`.
- Replace with your actual backend service URL in production

## Running the Development Server

1. **Start the application**:
   ```bash
   npm run dev
   ```

2. Open [http://localhost:9002](http://localhost:9002) in your browser

The page will auto-reload when you make changes to the code.

## Development Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## License

This project is licensed under the MIT License - see the LICENSE file for details.
