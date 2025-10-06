import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export function NoteView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="p-4">
      <div className="flex items-center gap-4 mb-6">
        <Button onClick={() => navigate(-1)} variant="ghost" size="icon">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Note: {id}</h1>
      </div>
      <p className="text-muted-foreground">
        Note view page - Coming soon
      </p>
    </div>
  );
}
