'use client';

import { useEffect, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { NButton, NDeleteDialog, NDialog, NSheet, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from 'najm-kit';

/**
 * Dialog chrome against reading direction.
 *
 * Flip to RTL and watch the header text and the close (X) swap sides together.
 * They used to disagree: the header was pinned `sm:text-left` and the X
 * `right-4`, both physical, so an Arabic dialog put the title on the left and
 * the X on the right — the mirror of what it should be.
 */
export default function DialogRtlPage() {
  const [rtl, setRtl] = useState(true);
  const [plain, setPlain] = useState(false);
  const [window_, setWindow] = useState(false);
  const [remove, setRemove] = useState(false);
  const [sheet, setSheet] = useState(false);

  // Dialogs portal to <body>, so `dir` has to live on <html> the way a real
  // app sets it. On a wrapper div it never reaches the portaled surface and
  // the demo silently tests LTR.
  useEffect(() => {
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = rtl ? 'ar' : 'en';
  }, [rtl]);

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <h1 className="text-xl font-semibold">{rtl ? 'اتجاه الحوار' : 'Dialog direction'}</h1>
        <div className="flex flex-wrap gap-2">
          <NButton variant={rtl ? 'default' : 'outline'} onClick={() => setRtl((v) => !v)}>{rtl ? 'RTL' : 'LTR'}</NButton>
          <NButton variant="outline" onClick={() => setPlain(true)}>Dialog</NButton>
          <NButton variant="outline" onClick={() => setWindow(true)}>NDialog · window</NButton>
          <NButton variant="outline" onClick={() => setRemove(true)}>NDeleteDialog</NButton>
          <NButton variant="outline" onClick={() => setSheet(true)}>NSheet</NButton>
        </div>

        <Dialog open={plain} onOpenChange={setPlain}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{rtl ? 'إنشاء سجل طفل' : 'Create child record'}</DialogTitle>
              <DialogDescription>{rtl ? 'أضف طفلًا إلى ملف أسرة موجود.' : 'Add a child to an existing family file.'}</DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{rtl ? 'يجب أن يقف العنوان والزر (X) على طرفين متقابلين.' : 'Title and the X belong on opposite edges.'}</p>
            <DialogFooter>
              <NButton onClick={() => setPlain(false)}>{rtl ? 'إنشاء طفل' : 'Create child'}</NButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <NDialog
          variant="window"
          open={window_}
          onOpenChange={setWindow}
          title={rtl ? 'إنشاء سجل طفل' : 'Create child record'}
          description={rtl ? 'أضف طفلًا إلى ملف أسرة موجود.' : 'Add a child to an existing family file.'}
        >
          <p className="p-4 text-sm text-muted-foreground">{rtl ? 'شريط العنوان يتبع اتجاه القراءة.' : 'The title bar follows the reading direction.'}</p>
        </NDialog>

        <NDeleteDialog
          open={remove}
          onOpenChange={setRemove}
          title={rtl ? 'حذف الطفل' : 'Delete child'}
          description={rtl ? 'لا يمكن التراجع.' : 'This cannot be undone.'}
          itemName={rtl ? 'ياسين' : 'Yassine'}
          itemType={rtl ? 'طفل' : 'child'}
          icon={Trash2}
          confirmText={rtl ? 'حذف' : 'Delete'}
          cancelText={rtl ? 'إلغاء' : 'Cancel'}
          onConfirm={() => setRemove(false)}
        />

        <NSheet
          open={sheet}
          onOpenChange={setSheet}
          icon={UserPlus}
          title={rtl ? 'إنشاء سجل طفل' : 'Create child record'}
          description={rtl ? 'أضف طفلًا إلى ملف أسرة موجود.' : 'Add a child to an existing family file.'}
        >
          <p className="text-sm text-muted-foreground">{rtl ? 'الزر (X) عند الحافة الابتدائية للقراءة.' : 'The X sits at the inline end.'}</p>
        </NSheet>
      </div>
    </div>
  );
}
