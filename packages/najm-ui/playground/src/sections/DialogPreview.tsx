import React from "react";
import { NMultiDialog, useDialog } from "najm-ui";
import { Button } from "najm-ui";

export default function DialogPreview() {
  const dialog = useDialog();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Dialog System</h2>
      <p className="text-sm text-muted-foreground">
        Multi-dialog stack with Promise-based push/pop API, configurable buttons, and delete confirmation.
      </p>

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() =>
            dialog.custom({
              title: "Simple Dialog",
              description: "A basic dialog with default buttons.",
              children: <p>This is the dialog content area.</p>,
            })
          }
        >
          Open Simple Dialog
        </Button>

        <Button
          variant="secondary"
          onClick={() =>
            dialog.custom({
              title: "Custom Buttons",
              description: "Dialog with custom primary/secondary actions.",
              children: <p>Click the buttons below to trigger actions.</p>,
              primaryButton: { text: "Save", variant: "default" },
              secondaryButton: { text: "Discard", variant: "destructive" },
            })
          }
        >
          Custom Buttons
        </Button>

        <Button
          variant="destructive"
          onClick={() =>
            dialog.confirmDelete({
              itemName: "Project Alpha",
              itemType: "project",
              onConfirm: async () => {
                await new Promise((r) => setTimeout(r, 1500));
              },
            })
          }
        >
          Delete Confirmation
        </Button>

        <Button
          variant="outline"
          onClick={() => {
            dialog.custom({
              title: "Outer Dialog",
              description: "First layer",
              children: (
                <div className="space-y-4">
                  <p>This is the outer dialog. Click below to stack another.</p>
                  <Button
                    size="sm"
                    onClick={() =>
                      dialog.custom({
                        title: "Inner Dialog",
                        description: "Second layer — stacked on top",
                        children: <p>This dialog is stacked. It z-indexes above.</p>,
                        size: "sm",
                      })
                    }
                  >
                    Open Nested
                  </Button>
                </div>
              ),
              size: "lg",
            });
          }}
        >
          Stacked Dialogs
        </Button>

        <Button variant="ghost" onClick={() => dialog.closeAll()}>
          Close All
        </Button>
      </div>

      <NMultiDialog />
    </div>
  );
}
