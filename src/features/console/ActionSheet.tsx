// Confirmation dialog for console actions: text, an optional (or required) reason, OK and Cancel.
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Button, Txt } from '@/ui/primitives';
import { CenterSheet } from '@/ui/sheet';

export function ActionSheet({ title, text, reason, reasonRequired, okLabel = 'OK', danger, onConfirm, onClose }: {
  title: string;
  text?: string;
  /** Shows the reason box with this label as its title text. */
  reason?: string;
  reasonRequired?: boolean;
  okLabel?: string;
  danger?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [value, setValue] = useState('');
  const showReason = reason != null || !!reasonRequired;
  const can = !reasonRequired || value.trim().length > 0;
  const placeholder = 'Reason' + (reasonRequired ? ' (required)' : '');
  return (
    <CenterSheet title={title} onClose={onClose}>
      {text ? <Txt v="body" color="inkMuted">{text}</Txt> : null}
      {showReason ? (
        <>
          {reason ? <Txt v="overline" color="inkMuted">{reason}</Txt> : null}
          <TextInput
            testID="action-reason"
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={c.inkMuted}
            multiline
            numberOfLines={2}
            accessibilityLabel={placeholder}
            style={[styles.input, { borderColor: c.controlBorder, backgroundColor: c.surfaceRaised, color: c.ink }]}
          />
        </>
      ) : null}
      <View style={styles.actions}>
        <Button label="Cancel" variant="secondary" onPress={onClose} />
        <Button label={okLabel} variant={danger ? 'danger' : 'primary'} disabled={!can} onPress={() => onConfirm(value.trim())} />
      </View>
    </CenterSheet>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 72, borderRadius: radius.md, borderWidth: 1.5, padding: space[3], fontSize: 16, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: space[3], justifyContent: 'flex-end' },
});
