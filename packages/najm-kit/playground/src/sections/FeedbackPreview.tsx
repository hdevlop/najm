import React from "react";
import { NSpinner, NLoadingState, NErrorState, NEmptyState, Badge, useDialog , NButton } from 'najm-kit';

export default function FeedbackPreview() {
  const dialog = useDialog();

  const openConfirm = () => {
    void dialog.confirmDelete({
      itemName: "feedback item",
      title: "Delete item?",
      description: "This action cannot be undone.",
      onConfirm: () => alert("Deleted!"),
    });
  };

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold">Feedback</h2>

      <div className="space-y-4">
        <h3 className="font-medium">Spinners</h3>
        <div className="flex gap-6 items-center">
          <div className="text-center"><NSpinner variant="default" /><p className="text-xs mt-1 text-muted-foreground">default</p></div>
          <div className="text-center"><NSpinner variant="circle" /><p className="text-xs mt-1 text-muted-foreground">circle</p></div>
          <div className="text-center"><NSpinner variant="pinwheel" /><p className="text-xs mt-1 text-muted-foreground">pinwheel</p></div>
          <div className="text-center"><NSpinner variant="ellipsis" /><p className="text-xs mt-1 text-muted-foreground">ellipsis</p></div>
          <div className="text-center"><NSpinner variant="ring" /><p className="text-xs mt-1 text-muted-foreground">ring</p></div>
          <div className="text-center"><NSpinner variant="bars" /><p className="text-xs mt-1 text-muted-foreground">bars</p></div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <NLoadingState label="Loading data..." />
        <NErrorState message="Network error" onRetry={() => alert("retry")} />
        <NEmptyState title="No items" description="Add your first item" />
      </div>

      <div className="space-y-4">
        <h3 className="font-medium">Badges</h3>
        <div className="flex flex-wrap gap-2">
          <Badge color="success" look="soft">Active</Badge>
          <Badge color="warning" look="outline">Pending</Badge>
          <Badge color="destructive" look="soft">Failed</Badge>
          <Badge color="neutral" look="dash">Draft</Badge>
          <Badge color="success" look="outline">Completed</Badge>
        </div>
      </div>

      <div>
        <NButton onClick={openConfirm} className="bg-destructive text-white px-4 py-2 rounded-md">Show Confirm</NButton>
      </div>
    </div>
  );
}
