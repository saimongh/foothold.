# foothold.

A minimalist, aesthetically driven task management system designed to bring clarity to your daily workflow. Foothold is a single-file application that runs entirely in your browser, offering privacy, portability, and a distraction-free environment.

## 📖 Why I Made This

Foothold was born out of a desire for a truly **personal** space to **organize** my ambitions. I needed a tool that didn't just list **tasks** and **goals**, but actively fostered a **productive environment** conducive to growth. My aim was to build **systems** that **automate** mental overhead and **streamline** my decision-making process, allowing me to focus on execution rather than management.

## ✨ Features

- **Dynamic Organization:** Create, rename, and delete custom categories to suit your workflow.
- **Drag-and-Drop:** Intuitively reorder your items to prioritize your day.
- **Subtasks:** Break down complex projects into manageable steps with a satisfying check-off system.
- **Focus Filters:** View "All Active," specific categories, or review your "Completed" history.
- **Visual Themes:** Toggle between a clean Light Mode and a sleek Dark Mode.
- **Data Portability:** Full Import/Export functionality via JSON, ensuring you own your data.
- **Local Privacy:** All data is stored in your browser's LocalStorage—no servers, no accounts, no tracking.

## 🚀 How to Use

### 1. Getting Started

Since Foothold is a self-contained application, there is no installation required. simply download the `index.html` file and open it in any modern web browser (Chrome, Safari, Firefox, Edge).

### 2. Managing Categories (Sidebar)

The sidebar is your command center.

- **Add:** Click the **`+ NEW CATEGORY`** button at the bottom of the sidebar to create a new bucket for your items.
- **Edit:** Hover over any category name to reveal the actions. Click the **Pencil** icon to rename it.
- **Delete:** Click the **Trash** icon to remove a category. _Warning: This will delete all tasks within that category._

### 3. Creating & Managing Items

- **New Item:** Click the small `+` button next to a category name in the sidebar to add an item directly to that section.
- **Subtasks:** Inside the creation modal, add specific steps. These appear as checkable boxes on the main card.
- **Completion:** Click the `✓` button on a card to move it to the "Completed" tab.
- **Reordering:** Click and hold the **grip icon** (dotted handle) on any card to drag and drop it into a new position.

### 4. Data Backup & Transfer

- **Export:** Click the **Download Icon** in the header to save your entire workspace (categories and tasks) as a `.json` file to your computer.
- **Import:** Click the **Import Icon** in the header to load a previously saved file. This allows you to move your setup between different browsers or computers.

## 🛠️ How I Made This

Foothold is built using **Vanilla HTML, CSS, and JavaScript**. I intentionally avoided heavy frameworks (like React or Vue) to keep the application lightweight, fast, and easy to modify.

**Key Technical Implementations:**

- **LocalStorage API:** Used to persist data across browser sessions without a backend database.
- **CSS Variables:** Implemented a root variable system to manage the color palette, enabling the seamless toggle between Light and Dark themes.
- **HTML5 Drag & Drop API:** Custom logic was written to handle the reordering of DOM elements and syncing that new order to the internal data array.
- **File Reader API:** Utilized to parse uploaded JSON files for the import feature, merging external data into the application state.

## 📄 License

This project is open-source. Feel free to fork, modify, and use it to build your own systems.
