import { AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader, AlertDialogContent, AlertDialogOverlay, Button } from '@chakra-ui/react';
import React, { useRef } from 'react';

interface DeleteAlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  title: string;
  bodyText?: string;
  cancelText?: string;
  deleteText?: string;
}

const DeleteAlertDialog: React.FC<DeleteAlertDialogProps> = ({
  isOpen,
  onClose,
  onDelete,
  title,
  bodyText = 'Are you sure you want to delete?',
  cancelText = 'Cancel',
  deleteText = 'Delete' }) => {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  return (
    <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose} isCentered>
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>
            {title}
          </AlertDialogHeader>
    
          <AlertDialogBody>
            {bodyText}
          </AlertDialogBody>

          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={onClose}>
              {cancelText}
            </Button>
            <Button colorScheme="red" onClick={onDelete}>
              {deleteText}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
};

export default DeleteAlertDialog;
