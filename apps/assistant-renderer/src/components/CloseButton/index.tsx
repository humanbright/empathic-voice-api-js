import { motion } from 'framer-motion';
import { useRef, ComponentRef, FC } from 'react';
import { useButton, mergeProps } from 'react-aria';
import { useSafeMotion } from '../../utils/useSafeMotion';
import { X } from 'lucide-react';

export type CloseButtonProps = {
  onPress: () => void;
};

export const CloseButton: FC<CloseButtonProps> = ({ onPress }) => {
  const closeButtonRef = useRef<ComponentRef<typeof motion.div>>(null);
  const { buttonProps: closeButtonProps } = useButton(
    {
      onPress: () => {
        onPress();
      },
    },
    closeButtonRef,
  );

  const buttonTransition = useSafeMotion({
    initial: {
      opacity: 0,
      scale: 0.5,
    },
    animate: {
      opacity: 1,
      scale: 1,
    },
    exit: {
      opacity: 0,
    },
  });

  return (
    <motion.div
      ref={closeButtonRef}
      className={
        'grid place-content-center size-[36px] cursor-pointer bg-red rounded-full'
      }
      {...mergeProps(closeButtonProps, buttonTransition)}
    >
      <X className={'w-5 h-5'} />
    </motion.div>
  );
};
