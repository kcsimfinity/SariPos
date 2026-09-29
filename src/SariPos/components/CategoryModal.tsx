import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { usePOS } from '../context/POSContext';
import { dbService } from '../database/databaseService';
import { getTheme } from '../theme/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const CategoryModal: React.FC<Props> = ({ visible, onClose }) => {
  const { categories, settings, refreshCategories } = usePOS();
  const theme = getTheme(settings.theme === 'dark');

  const [newCatName, setNewCatName] = useState('');

  const handleAdd = async () => {
    if (!newCatName.trim()) {
      Alert.alert('Validation Error', 'Please enter a category name.');
      return;
    }

    try {
      await dbService.addCategory(newCatName.trim());
      setNewCatName('');
      await refreshCategories();
    } catch (e: any) {
      Alert.alert('Category Error', e.message || 'Failed to create category.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    Alert.alert('Delete Category', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await dbService.deleteCategory(id);
          await refreshCategories();
        }
      }
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.fullScreenContainer, { backgroundColor: theme.bg }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* HEADER */}
          <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
            </TouchableOpacity>

            <View style={styles.headerTitleGroup}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Manage Categories</Text>
            </View>

            <TouchableOpacity style={[styles.doneHeaderBtn, { backgroundColor: theme.primary }]} onPress={onClose} activeOpacity={0.8}>
              <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
              <Text style={styles.doneHeaderBtnText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* BODY */}
          <View style={styles.body}>
            <View style={styles.sectionBox}>
              <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>CREATE CATEGORY</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.bigInput, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.border }]}
                  placeholder="e.g., Beverages, Snacks..."
                  placeholderTextColor={theme.textMuted}
                  value={newCatName}
                  onChangeText={setNewCatName}
                />

                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: theme.primary }]}
                  onPress={handleAdd}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.stepLabel, { color: theme.textSecondary, marginBottom: 8 }]}>
                EXISTING CATEGORIES ({categories.length})
              </Text>

              {categories.length === 0 ? (
                <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Ionicons name="folder-open-outline" size={32} color={theme.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.textPrimary }]}>
                    No categories created yet.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={categories}
                  keyExtractor={item => item.id}
                  numColumns={2}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 16 }}
                  renderItem={({ item }) => (
                    <View style={[styles.catCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <View style={styles.catCardLeft}>
                        <View style={[styles.tagIconBadge, { backgroundColor: theme.surfaceElevated }]}>
                          <Ionicons name="pricetag" size={14} color={theme.accent} />
                        </View>
                        <Text style={[styles.catName, { color: theme.textPrimary }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => handleDelete(item.id, item.name)}
                        style={styles.deleteBtn}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={16} color={theme.danger} />
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  backBtn: { padding: 4 },
  headerTitleGroup: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800' },
  doneHeaderBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  doneHeaderBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  body: { flex: 1, padding: 16, gap: 20 },
  sectionBox: { gap: 8 },
  stepLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  inputRow: { flexDirection: 'row', gap: 10 },
  bigInput: { flex: 1, paddingHorizontal: 16, height: 48, borderRadius: 12, borderWidth: 1, fontSize: 15, fontWeight: '700' },
  addBtn: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  catCard: { flex: 1 / 2, margin: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, height: 48, borderRadius: 12, borderWidth: 1 },
  catCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 6 },
  tagIconBadge: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  catName: { fontSize: 13, fontWeight: '700', flex: 1 },
  deleteBtn: { padding: 4 },
  emptyBox: { padding: 30, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '800' },
});