import { DataTypes } from 'sequelize';

/**
 * Two tables:
 *  - tests:    one row per test; questions and settings are stored as JSON.
 *  - attempts: one row per submitted response.
 */
export function defineModels(sequelize) {
  const JSON_TYPE = sequelize.getDialect() === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;

  const Test = sequelize.define(
    'Test',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      publicId: { type: DataTypes.STRING(16), allowNull: false, unique: true },
      adminKeyHash: { type: DataTypes.STRING(64), allowNull: false },
      title: { type: DataTypes.STRING(150), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      questions: { type: JSON_TYPE, allowNull: false },
      settings: { type: JSON_TYPE, allowNull: false },
      isOpen: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      responseCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      creatorIpHash: { type: DataTypes.STRING(64), allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
    },
    {
      tableName: 'tests',
      underscored: true,
      indexes: [
        { name: 'tests_creator_ip_hash_created_at', fields: ['creator_ip_hash', 'created_at'] },
        { name: 'tests_created_at', fields: ['created_at'] },
        { name: 'tests_expires_at', fields: ['expires_at'] },
      ],
    },
  );

  const Attempt = sequelize.define(
    'Attempt',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      testId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'tests', key: 'id' },
        onDelete: 'CASCADE',
      },
      // Random value from the signed start token; makes "submit" safe to retry.
      nonce: { type: DataTypes.STRING(32), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(80), allowNull: false, defaultValue: '' },
      extra: { type: DataTypes.STRING(120), allowNull: false, defaultValue: '' },
      questionIds: { type: JSON_TYPE, allowNull: false },
      answers: { type: JSON_TYPE, allowNull: false },
      results: { type: JSON_TYPE, allowNull: false },
      score: { type: DataTypes.INTEGER, allowNull: false },
      maxScore: { type: DataTypes.INTEGER, allowNull: false },
      percent: { type: DataTypes.FLOAT, allowNull: false },
      durationSeconds: { type: DataTypes.INTEGER, allowNull: false },
      tabLeaves: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      overtime: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      ipHash: { type: DataTypes.STRING(64), allowNull: false },
      startedAt: { type: DataTypes.DATE, allowNull: false },
    },
    {
      tableName: 'attempts',
      underscored: true,
      updatedAt: false,
      indexes: [
        { name: 'attempts_test_id_created_at', fields: ['test_id', 'created_at'] },
        { name: 'attempts_test_id_ip_hash_created_at', fields: ['test_id', 'ip_hash', 'created_at'] },
      ],
    },
  );

  Test.hasMany(Attempt, { foreignKey: 'testId', onDelete: 'CASCADE' });
  Attempt.belongsTo(Test, { foreignKey: 'testId' });

  return { Test, Attempt };
}
